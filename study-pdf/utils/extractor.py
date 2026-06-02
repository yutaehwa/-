import asyncio
import base64
import json as _json
import re
from urllib.parse import urljoin

import requests
import urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from utils.scraper import USER_AGENT

MAX_IMAGES = 30
MAX_TEXT_LENGTH = 50_000

# 1차: 본문 추출 전 페이지 전체에서 제거
REMOVE_SELECTORS = [
    "script", "style", "noscript", "iframe", "form", "button",
    # 광고
    "[class~='ad']", "[class^='ad-']", "[class$='-ad']", "[class*='__ad']",
    "[id~='ad']", "[id^='ad-']", "[id$='-ad']",
    "[class*='banner']", "[id*='banner']",
    "[class*='popup']", "[class*='overlay']", "[class*='modal']",
    # 레이아웃 구조
    "nav", "header", "footer", "aside",
    "[role='navigation']", "[role='banner']", "[role='complementary']",
    "[class*='sidebar']", "[id*='sidebar']",
    "[class*='header']", "[id*='header']",
    "[class*='footer']", "[id*='footer']",
    "[class*='nav']", "[id*='nav']",
    "[class*='menu']", "[id*='menu']",
    "[class*='toolbar']", "[id*='toolbar']",
    # 댓글·소셜·공유
    "[class*='comment']", "[id*='comment']",
    "[class*='social']", "[class*='share']",
    "[class*='like']", "[class*='reaction']",
    # 구독·추천·관련
    "[class*='subscribe']", "[class*='newsletter']",
    "[class*='recommend']", "[class*='related']", "[id*='related']",
    "[class*='more-article']", "[class*='more_article']",
    "[class*='read-more']", "[class*='read_more']",
    # 탐색 보조
    "[class*='breadcrumb']", "[id*='breadcrumb']",
    "[class*='pagination']", "[id*='pagination']",
    "[class*='toc']", "[id*='toc']",
    # 태그·카테고리
    "[class*='tag']", "[id*='tag']",
    "[class*='category']", "[id*='category']",
    "[class*='label']",
    # 광고 네트워크
    "[class*='taboola']", "[class*='outbrain']", "[class*='zergnet']",
    # 쿠키·알림
    "[class*='cookie']", "[class*='gdpr']", "[class*='consent']",
    "[class*='notification']", "[class*='alert']",
    # 기타
    "[class*='print']", "[class*='hidden']",
    "[aria-hidden='true']",
]

# 2차: content_el 내부에서 한 번 더 제거 (더 보수적으로)
INNER_REMOVE_SELECTORS = [
    "nav", "header", "footer", "aside", "form", "button",
    "[class*='share']", "[class*='social']",
    "[class*='related']", "[class*='recommend']",
    "[class*='tag']", "[class*='category']",
    "[class*='breadcrumb']", "[class*='pagination']",
    "[class*='comment']", "[class*='subscribe']", "[class*='newsletter']",
    "[class*='ad']", "[class*='banner']",
    "[class*='toolbar']", "[class*='toc']",
    "[class*='author-bio']", "[class*='author_bio']",
    "[aria-hidden='true']",
]

CONTENT_SELECTORS = [
    "article",
    "main",
    "[role='main']",
    ".mw-parser-output",
    "#mw-content-text",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".article__content",
    ".post__content",
    ".blog-content",
    ".content-body",
    ".content",
    "#content",
    "#main",
    "#bodyContent",
]

# HTML에서 허용할 태그 (나머지는 텍스트만 남김)
ALLOWED_TAGS = {
    "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "strong", "b", "em", "i", "u", "s", "del", "ins", "mark",
    "a", "img", "figure", "figcaption",
    "blockquote", "pre", "code",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "div", "span",
    "hr",
}


async def extract_content(html: str, source_url: str) -> dict:
    return await asyncio.to_thread(_extract_sync, html, source_url)


def _extract_sync(html: str, source_url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    # 메타 정보 추출 (스크립트 제거 전에 실행)
    title = _get_meta(soup, "og:title") or (soup.title.string if soup.title else "") or ""
    author = _get_meta(soup, "author") or _get_meta(soup, "article:author") or ""
    published_date = (
        _get_meta(soup, "article:published_time")
        or _get_meta(soup, "date")
        or (soup.find("time", attrs={"datetime": True}) or {}).get("datetime")
        or ""
    )

    # JS 렌더 사이트 전용 추출 — 스크립트 제거 전에 실행해야 함
    content_el = _try_fusion_cms(soup) or _try_json_ld_body(soup)

    # 1차: 페이지 전체에서 불필요 요소 제거
    for selector in REMOVE_SELECTORS:
        for el in soup.select(selector):
            el.decompose()

    # DOM 기반 본문 추출
    if content_el is None:
        for selector in CONTENT_SELECTORS:
            el = soup.select_one(selector)
            if el and len(el.get_text(strip=True)) > 200:
                content_el = el
                break

    # 폴백: 단락 모음
    if content_el is None:
        body = soup.find("body")
        if body:
            paras = body.find_all("p")
            total_text = "".join(p.get_text() for p in paras)
            if len(total_text.strip()) > 200:
                wrapper = soup.new_tag("div")
                for p in paras:
                    wrapper.append(p)
                content_el = wrapper

    if content_el is None:
        raise ValueError("읽을 수 있는 본문을 찾지 못했습니다.")

    # 2차: content_el 내부에서 한 번 더 불필요 요소 제거
    for selector in INNER_REMOVE_SELECTORS:
        for el in content_el.select(selector):
            el.decompose()

    # 불필요 속성 정리 (class, id, style 제거 → PDF 스타일 일관성)
    _clean_attributes(content_el)

    # 글자 수 제한 확인
    plain_text = content_el.get_text(strip=True)
    if len(plain_text) > MAX_TEXT_LENGTH:
        raise ValueError("본문이 너무 깁니다. 더 짧은 페이지를 시도해 주세요.")

    # 이미지 다운로드 → base64 임베드
    imgs = content_el.find_all("img")[:MAX_IMAGES]
    for img in imgs:
        srcset_parts = (img.get("srcset") or "").split()
        src = (
            img.get("src")
            or img.get("data-src")
            or img.get("data-lazy-src")
            or (srcset_parts[0] if srcset_parts else "")
            or ""
        )
        if not src or src.startswith("data:"):
            continue

        src = urljoin(source_url, src)
        data_url = _download_image(src, source_url)
        if data_url:
            img["src"] = data_url
            for attr in ["srcset", "class", "style", "width", "height"]:
                img.attrs.pop(attr, None)
        else:
            img.decompose()

    content_html = str(content_el)
    preview_text = content_el.get_text(separator=" ", strip=True)[:500]

    return {
        "title": title.strip(),
        "author": author.strip(),
        "published_date": str(published_date or ""),
        "source_url": source_url,
        "content_html": content_html,
        "preview_text": preview_text,
    }


def _clean_attributes(el):
    """모든 요소에서 class, id, style, data-* 속성을 제거해 외부 CSS 오염 방지."""
    for tag in el.find_all(True):
        remove = [a for a in list(tag.attrs) if a in ("class", "id", "style") or a.startswith("data-")]
        for a in remove:
            del tag.attrs[a]
        # 허용되지 않는 태그는 내용물만 남김 (unwrap)
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()


def _try_fusion_cms(soup: BeautifulSoup):
    """Fusion CMS (조선일보 등) — window.Fusion.globalContent.content_elements 추출"""
    fm = soup.find(id="fusion-metadata")
    if not fm:
        return None
    txt = fm.get_text()
    marker = "Fusion.globalContent="
    idx = txt.find(marker)
    if idx == -1:
        return None
    try:
        decoder = _json.JSONDecoder()
        gc, _ = decoder.raw_decode(txt, idx + len(marker))
    except (_json.JSONDecodeError, ValueError):
        return None

    elements = gc.get("content_elements", [])
    if not elements:
        return None

    wrapper = soup.new_tag("div")
    text_count = 0
    for el in elements:
        etype = el.get("type", "")
        if etype == "text":
            content = (el.get("content") or "").strip()
            if content:
                p = soup.new_tag("p")
                p.string = content
                wrapper.append(p)
                text_count += 1
        elif etype == "image":
            img_url = (el.get("url") or "").strip()
            caption = (el.get("caption") or "").strip()
            if img_url:
                fig = soup.new_tag("figure")
                img_tag = soup.new_tag("img")
                img_tag["src"] = img_url
                img_tag["alt"] = caption
                fig.append(img_tag)
                if caption:
                    figcap = soup.new_tag("figcaption")
                    figcap.string = caption
                    fig.append(figcap)
                wrapper.append(fig)

    return wrapper if text_count > 0 else None


def _try_json_ld_body(soup: BeautifulSoup):
    """JSON-LD articleBody에서 본문 추출 (일부 뉴스/블로그 사이트)"""
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            d = _json.loads(s.string or "")
            body = d.get("articleBody", "").strip()
            if len(body) > 200:
                wrapper = soup.new_tag("div")
                for para in body.split("\n"):
                    para = para.strip()
                    if para:
                        p = soup.new_tag("p")
                        p.string = para
                        wrapper.append(p)
                if wrapper.find("p"):
                    return wrapper
        except (_json.JSONDecodeError, AttributeError):
            pass
    return None


def _get_meta(soup: BeautifulSoup, name: str) -> str:
    tag = soup.find("meta", attrs={"property": name}) or soup.find(
        "meta", attrs={"name": name}
    )
    return (tag or {}).get("content", "").strip()


def _download_image(src: str, referer: str) -> str | None:
    try:
        resp = requests.get(
            src,
            timeout=8,
            headers={"Referer": referer, "User-Agent": USER_AGENT},
            stream=True,
            verify=False,
        )
        resp.raise_for_status()
        ct = resp.headers.get("content-type", "image/jpeg").split(";")[0]
        if not ct.startswith("image/"):
            return None
        data = base64.b64encode(resp.content).decode()
        return f"data:{ct};base64,{data}"
    except Exception:
        return None
