import asyncio
import json
import re
import secrets
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from utils.url_validator import validate_url
from utils.scraper import fetch_html
from utils.extractor import extract_content
from utils.pdf_generator import generate_pdf

TEMP_DIR = Path(__file__).parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

app = FastAPI()

# 파일 ID → 원본 파일명 매핑
pdf_filenames: dict[str, str] = {}

# IP별 일일 횟수 제한
rate_limits: dict[str, int] = {}
DAILY_LIMIT = 5


def _rate_key(ip: str) -> str:
    from datetime import date
    return f"{ip}:{date.today()}"


def check_rate_limit(ip: str) -> bool:
    key = _rate_key(ip)
    count = rate_limits.get(key, 0) + 1
    rate_limits[key] = count
    return count <= DAILY_LIMIT


async def _delete_later(path: Path, file_id: str, delay: int = 3600):
    await asyncio.sleep(delay)
    path.unlink(missing_ok=True)
    pdf_filenames.pop(file_id, None)


@app.post("/api/convert")
async def convert(request: Request):
    ip = request.client.host if request.client else "0.0.0.0"

    # JSON 파싱 (오류 처리 포함)
    try:
        body = await request.json()
    except Exception as e:
        print(f"[400] JSON 파싱 실패: {e!r}")
        return JSONResponse({"error": "잘못된 요청입니다."}, status_code=400)

    raw_url = body.get("url", "") if isinstance(body, dict) else ""

    valid, url, err_msg = validate_url(raw_url)
    if not valid:
        print(f"[400] URL 검증 실패: {raw_url!r} → {err_msg}")
        return JSONResponse({"error": err_msg}, status_code=400)

    # URL 검증 통과 후 횟수 차감 (실패 요청은 소모 안 함)
    if not check_rate_limit(ip):
        return JSONResponse(
            {"error": "오늘 무료 변환 횟수(5회)를 모두 사용하셨습니다. 내일 다시 시도해 주세요."},
            status_code=429,
        )

    try:
        async with asyncio.timeout(90):
            html = await fetch_html(url)
            content = await extract_content(html, url)
            pdf_bytes, filename = await generate_pdf(content)

    except asyncio.TimeoutError:
        return JSONResponse(
            {"error": "처리 시간이 초과되었습니다. 다시 시도해 주세요."},
            status_code=504,
        )
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception as e:
        msg = str(e)
        print(f"[오류] {msg}")
        if any(k in msg for k in ("접속할 수 없", "ConnectionError", "ENOTFOUND")):
            err = "해당 사이트에 접속할 수 없습니다."
        elif "차단" in msg or "403" in msg:
            err = "해당 사이트에서 접근을 차단하고 있습니다."
        elif "찾을 수 없" in msg or "404" in msg:
            err = "해당 페이지를 찾을 수 없습니다."
        elif "본문" in msg or "너무" in msg:
            err = msg
        else:
            err = "PDF 생성 중 문제가 발생했습니다. 다시 시도해 주세요."
        return JSONResponse({"error": err}, status_code=500)

    # 임시 저장
    file_id = secrets.token_urlsafe(16)
    filepath = TEMP_DIR / f"{file_id}.pdf"
    filepath.write_bytes(pdf_bytes)
    pdf_filenames[file_id] = filename
    asyncio.create_task(_delete_later(filepath, file_id))

    return JSONResponse({
        "success": True,
        "fileId": file_id,
        "filename": filename,
        "title": content.get("title", ""),
        "preview": content.get("preview_text", ""),
    })


@app.get("/api/download/{file_id}")
async def download(file_id: str):
    if not re.match(r"^[A-Za-z0-9_\-]+$", file_id):
        return JSONResponse({"error": "잘못된 요청입니다."}, status_code=400)

    filepath = TEMP_DIR / f"{file_id}.pdf"
    if not filepath.exists():
        return JSONResponse(
            {"error": "파일을 찾을 수 없습니다. 다시 변환해 주세요."},
            status_code=404,
        )

    filename = pdf_filenames.get(file_id, "document.pdf")
    return FileResponse(
        path=str(filepath),
        media_type="application/pdf",
        filename=filename,
    )


app.mount("/", StaticFiles(directory=str(Path(__file__).parent / "public"), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    print("\n  웹페이지 PDF 변환기 실행 중")
    print("  → http://localhost:8000\n")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
