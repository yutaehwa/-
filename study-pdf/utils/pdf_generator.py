import html as html_lib
import re
from datetime import datetime
from playwright.async_api import async_playwright


def _esc(text: str) -> str:
    return html_lib.escape(str(text or ""))


def _format_date(date_str: str) -> str:
    if not date_str:
        return ""
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%Y년 %m월 %d일")
    except Exception:
        return date_str


def _sanitize_filename(title: str) -> str:
    today = datetime.now().strftime("%Y-%m-%d")
    safe = re.sub(r'[\\/:*?"<>|]', "", title or "문서")
    safe = re.sub(r"\s+", "_", safe).strip("_")[:50] or "문서"
    return f"{safe}_{today}.pdf"


def _build_html(content: dict) -> str:
    title = _esc(content.get("title") or "제목 없음")
    author = _esc(content.get("author") or "")
    date_str = _format_date(content.get("published_date") or "")
    source_url = _esc(content.get("source_url") or "")
    content_html = content.get("content_html") or ""
    saved_date = datetime.now().strftime("%Y년 %m월 %d일")

    meta_rows = ""
    if author:
        meta_rows += f"<div>작성자: {author}</div>"
    if date_str:
        meta_rows += f"<div>작성일: {date_str}</div>"
    meta_rows += f'<div>출처: <a href="{source_url}">{source_url}</a></div>'

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 11pt;
    line-height: 1.8;
    color: #222;
    background: #fff;
  }}
  .cover {{
    padding-bottom: 22px;
    border-bottom: 2px solid #333;
    margin-bottom: 26px;
  }}
  .cover-title {{
    font-size: 21pt;
    font-weight: 700;
    line-height: 1.4;
    margin-bottom: 12px;
    color: #111;
    word-break: keep-all;
  }}
  .cover-meta {{ font-size: 9pt; color: #666; line-height: 2; }}
  .cover-meta a {{ color: #2563eb; text-decoration: none; word-break: break-all; }}
  .content h1, .content h2, .content h3, .content h4 {{
    margin-top: 22px; margin-bottom: 10px;
    font-weight: 700; line-height: 1.4; word-break: keep-all;
  }}
  .content h1 {{ font-size: 18pt; }}
  .content h2 {{ font-size: 15pt; }}
  .content h3 {{ font-size: 13pt; }}
  .content h4 {{ font-size: 11pt; }}
  .content p  {{ margin-bottom: 12px; word-break: keep-all; overflow-wrap: break-word; }}
  .content img {{
    max-width: 100%; height: auto; display: block;
    margin: 16px auto; page-break-inside: avoid;
  }}
  .content figure {{ margin: 16px 0; page-break-inside: avoid; }}
  .content figcaption {{ font-size: 9pt; color: #666; text-align: center; margin-top: 4px; }}
  .content ul, .content ol {{ margin: 10px 0 10px 24px; }}
  .content li {{ margin-bottom: 6px; }}
  .content table {{
    width: 100%; border-collapse: collapse;
    margin: 16px 0; font-size: 10pt; page-break-inside: avoid;
  }}
  .content th, .content td {{ border: 1px solid #ccc; padding: 8px 10px; text-align: left; }}
  .content th {{ background: #f0f0f0; font-weight: 700; }}
  .content blockquote {{
    border-left: 3px solid #aaa; padding: 8px 14px;
    margin: 14px 0; color: #555;
  }}
  .content pre {{
    background: #f5f5f5; padding: 12px; border-radius: 4px;
    font-size: 9pt; margin: 12px 0; page-break-inside: avoid; overflow-x: auto;
  }}
  .content code {{
    background: #f5f5f5; padding: 1px 5px;
    border-radius: 3px; font-size: 9pt;
  }}
  .content a {{ color: #2563eb; }}
  .footer {{
    border-top: 1px solid #ddd; padding-top: 14px; margin-top: 40px;
    font-size: 8pt; color: #999; line-height: 1.8;
  }}
  @page {{
    size: A4;
    margin: 20mm;
    @bottom-center {{
      content: counter(page) " / " counter(pages);
      font-size: 9pt; color: #999;
    }}
  }}
  @media print {{
    h1, h2, h3 {{ page-break-after: avoid; }}
    img, figure, table {{ page-break-inside: avoid; }}
  }}
</style>
</head>
<body>
<div class="cover">
  <div class="cover-title">{title}</div>
  <div class="cover-meta">{meta_rows}</div>
</div>
<div class="content">{content_html}</div>
<div class="footer">
  저장일: {saved_date} · 개인 학습 및 보관 목적으로 저장된 문서입니다.
</div>
</body>
</html>"""


async def generate_pdf(content: dict) -> tuple[bytes, str]:
    html = _build_html(content)

    from utils.browser import CHROME_EXE, LAUNCH_ARGS

    async with async_playwright() as p:
        launch_kwargs = {"headless": True, "args": LAUNCH_ARGS}
        if CHROME_EXE:
            launch_kwargs["executable_path"] = CHROME_EXE
        browser = await p.chromium.launch(**launch_kwargs)
        page = await browser.new_page()
        await page.set_content(html, wait_until="domcontentloaded", timeout=30000)

        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template="<div></div>",
            footer_template=(
                "<div style='font-size:9pt;color:#999;width:100%;text-align:center;padding:0 20mm;'>"
                "<span class='pageNumber'></span> / <span class='totalPages'></span>"
                "</div>"
            ),
            margin={"top": "20mm", "right": "20mm", "bottom": "25mm", "left": "20mm"},
        )

        await browser.close()

    filename = _sanitize_filename(content.get("title") or "")
    return pdf_bytes, filename
