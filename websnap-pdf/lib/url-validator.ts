const BLOCKED_PATTERNS = [
  /^file:\/\//i,
  /^javascript:/i,
  /^data:/i,
  /localhost/i,
  /127\.0\.0\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /0\.0\.0\.0/,
  /::1/,
]

export function validateUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return '유효하지 않은 URL입니다.'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'http 또는 https URL만 지원합니다.'
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(url)) {
      return '접근할 수 없는 URL입니다.'
    }
  }

  return null
}
