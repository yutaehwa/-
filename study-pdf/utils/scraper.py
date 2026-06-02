import asyncio
import re

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

_MIN_TEXT_LEN = 300


def _has_content(html: str) -> bool:
    """script/style 제거 후 텍스트가 _MIN_TEXT_LEN 이상이면 True."""
    s = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    s = re.sub(r"<style[^>]*>.*?</style>", " ", s, flags=re.DOTALL | re.IGNORECASE)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return len(s) >= _MIN_TEXT_LEN


async def fetch_html(url: str) -> str:
    # 1단계: 정적 fetch
    html = None
    try:
        html = await asyncio.to_thread(_fetch_static, url)
    except _BlockedError:
        raise
    except Exception as e:
        print(f"[scraper] 정적 요청 실패: {e}")

    # 2단계: 정적 성공 + 내용 충분 → 바로 반환
    if html is not None and _has_content(html):
        return html

    # 3단계: 정적 실패 또는 내용 없음 → 동적 렌더링
    reason = "내용 없음" if html is not None else "요청 실패"
    print(f"[scraper] 정적 HTML {reason} → 동적 렌더링 시도")
    return await _fetch_dynamic(url)


def _fetch_static(url: str) -> str:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, verify=False)
    except requests.exceptions.ConnectionError:
        raise Exception("해당 사이트에 접속할 수 없습니다.")
    except requests.exceptions.Timeout:
        raise Exception("사이트 응답이 너무 느립니다.")

    if resp.status_code == 404:
        raise Exception("해당 페이지를 찾을 수 없습니다.")
    if resp.status_code in (401, 403):
        raise _BlockedError("해당 사이트에서 접근을 차단하고 있습니다.")
    if resp.status_code >= 400:
        raise Exception(f"사이트 오류 (HTTP {resp.status_code}).")

    ct = resp.headers.get("content-type", "")
    if "text/html" not in ct:
        raise Exception("HTML 페이지가 아닙니다.")

    return resp.text


async def _fetch_dynamic(url: str) -> str:
    from playwright.async_api import async_playwright
    from utils.browser import CHROME_EXE, LAUNCH_ARGS

    try:
        async with async_playwright() as p:
            launch_kwargs = {"headless": True, "args": LAUNCH_ARGS}
            if CHROME_EXE:
                launch_kwargs["executable_path"] = CHROME_EXE
            browser = await p.chromium.launch(**launch_kwargs)
            # user_agent은 context 레벨에서 설정 (page.set_user_agent 없음)
            ctx = await browser.new_context(
                user_agent=USER_AGENT,
                extra_http_headers={"Accept-Language": "ko-KR,ko;q=0.9"},
            )
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            html = await page.content()
            await browser.close()
            return html
    except Exception as e:
        raise Exception("해당 사이트에 접속할 수 없습니다.")


class _BlockedError(Exception):
    pass
