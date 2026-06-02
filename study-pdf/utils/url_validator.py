import re
from urllib.parse import urlparse


def validate_url(raw_url: str) -> tuple[bool, str, str]:
    """URL 검증. (valid, url, error_message) 반환"""
    if not raw_url or not raw_url.strip():
        return False, "", "웹사이트 주소를 입력해 주세요."

    url = raw_url.strip()

    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = "https://" + url

    if len(url) > 2000:
        return False, "", "주소가 너무 깁니다."

    if re.match(r"^(file|ftp|javascript|data):", url, re.IGNORECASE):
        return False, "", "지원하지 않는 주소 형식입니다."

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "", "올바른 웹사이트 주소가 아닙니다."

    if not parsed.scheme or not parsed.netloc:
        return False, "", "올바른 웹사이트 주소가 아닙니다."

    hostname = parsed.hostname or ""

    # SSRF 방지: 내부 주소 차단
    blocked_hostnames = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
    if hostname.lower() in blocked_hostnames:
        return False, "", "접근할 수 없는 주소입니다."

    ipv4 = re.match(r"^(\d+)\.(\d+)\.(\d+)\.(\d+)$", hostname)
    if ipv4:
        a, b = int(ipv4.group(1)), int(ipv4.group(2))
        if (
            a == 10
            or (a == 172 and 16 <= b <= 31)
            or (a == 192 and b == 168)
            or a == 127
            or a == 0
            or a == 169
        ):
            return False, "", "접근할 수 없는 주소입니다."

    return True, url, ""
