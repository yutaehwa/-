import puppeteer, { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const MARGIN_MAP = {
  none: { top: '0', right: '0', bottom: '0', left: '0' },
  small: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  normal: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  large: { top: '30mm', right: '30mm', bottom: '30mm', left: '30mm' },
}

export type PdfOptions = {
  format?: string
  orientation?: string
  margin?: string
}

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance) return browserInstance

  const executablePath = await chromium.executablePath()

  browserInstance = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--disable-web-security',
    ],
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: true,
  })

  return browserInstance
}

function buildCleanHtml(params: {
  title: string
  byline: string | null
  content: string
  sourceUrl: string
}): string {
  const { title, byline, content, sourceUrl } = params
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
    font-size: 16px;
    line-height: 1.8;
    color: #1a1a1a;
    max-width: 740px;
    margin: 0 auto;
    padding: 0 24px;
  }
  header {
    border-bottom: 2px solid #e5e7eb;
    padding: 32px 0 24px;
    margin-bottom: 32px;
  }
  h1.article-title {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.4;
    color: #111827;
    margin-bottom: 10px;
  }
  .byline { font-size: 14px; color: #6b7280; }
  .source-url { font-size: 12px; color: #9ca3af; margin-top: 4px; word-break: break-all; }
  article h1, article h2 { font-size: 22px; font-weight: 700; margin: 28px 0 12px; color: #111827; }
  article h3 { font-size: 18px; font-weight: 600; margin: 24px 0 10px; color: #374151; }
  article p { margin-bottom: 16px; }
  article a { color: #2563eb; text-decoration: none; }
  article img { max-width: 100%; height: auto; border-radius: 6px; margin: 16px 0; }
  article ul, article ol { margin: 12px 0 16px 24px; }
  article li { margin-bottom: 6px; }
  article blockquote {
    border-left: 4px solid #d1d5db;
    padding-left: 16px;
    color: #6b7280;
    margin: 16px 0;
    font-style: italic;
  }
  article pre, article code {
    background: #f3f4f6;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
  }
  article pre { padding: 12px 16px; overflow-x: auto; margin: 12px 0; }
  article code { padding: 2px 5px; }
  article table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  article th, article td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  article th { background: #f9fafb; font-weight: 600; }
  footer {
    border-top: 1px solid #e5e7eb;
    margin-top: 40px;
    padding: 16px 0 32px;
    font-size: 11px;
    color: #9ca3af;
  }
</style>
</head>
<body>
<header>
  <h1 class="article-title">${escapeHtml(title)}</h1>
  ${byline ? `<p class="byline">${escapeHtml(byline)}</p>` : ''}
  <p class="source-url">출처: ${escapeHtml(sourceUrl)}</p>
</header>
<article>${content}</article>
<footer>WebSnap PDF로 변환됨 &middot; ${new Date().toLocaleDateString('ko-KR')}</footer>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function captureScreenshot(url: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })

    return Buffer.from(screenshot)
  } finally {
    await page.close()
  }
}

export async function convertUrlToPdf(
  url: string,
  options: PdfOptions = {}
): Promise<{ buffer: Buffer; title: string }> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1280, height: 800 })

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    const rawHtml = await page.content()
    const pageTitle = await page.title()

    // Readability로 본문 추출 시도
    const dom = new JSDOM(rawHtml, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    let htmlToRender: string

    if (article && article.content) {
      htmlToRender = buildCleanHtml({
        title: article.title || pageTitle,
        byline: article.byline ?? null,
        content: article.content,
        sourceUrl: url,
      })
      await page.setContent(htmlToRender, { waitUntil: 'load' })
    }
    // Readability 실패 시 원본 페이지 그대로 사용

    const format = (options.format || 'A4') as 'A4' | 'Letter'
    const landscape = options.orientation === 'landscape'
    const margin = MARGIN_MAP[(options.margin as keyof typeof MARGIN_MAP) || 'normal']

    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin,
      printBackground: true,
    })

    const title = article?.title || pageTitle || 'page'
    return { buffer: Buffer.from(pdfBuffer), title }
  } finally {
    await page.close()
  }
}
