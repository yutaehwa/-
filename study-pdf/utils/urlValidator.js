function validateUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) {
    return { valid: false, error: '웹사이트 주소를 입력해 주세요.' };
  }

  let url = rawUrl.trim();

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  if (url.length > 2000) {
    return { valid: false, error: '주소가 너무 깁니다.' };
  }

  if (/^(file|ftp|javascript|data):/i.test(url)) {
    return { valid: false, error: '지원하지 않는 주소 형식입니다.' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: '올바른 웹사이트 주소가 아닙니다.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF 방지: 내부 IP 차단
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') {
    return { valid: false, error: '접근할 수 없는 주소입니다.' };
  }

  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127 ||
      a === 0 ||
      a === 169
    ) {
      return { valid: false, error: '접근할 수 없는 주소입니다.' };
    }
  }

  return { valid: true, url };
}

module.exports = { validateUrl };
