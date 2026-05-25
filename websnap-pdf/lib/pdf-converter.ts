import puppeteer, { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

const MARGIN_MAP = {
  none: { top: '0', right: '0', bottom: '0', left: '0' },
  small: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  normal: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  large: { top: '30mm', right: '30mm', bottom: '30mm', left: '30mm' },
}

type PdfOptions = {
  format?: string
  orientation?: string
  margin?: string
}

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance) return browserInstance

  const executablePath = await chromium.executablePath()

  browserInstance = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: true,
  })

  return browserInstance
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

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    const title = await page.title()

    const format = (options.format || 'A4') as 'A4' | 'Letter'
    const landscape = options.orientation === 'landscape'
    const margin = MARGIN_MAP[(options.margin as keyof typeof MARGIN_MAP) || 'normal']

    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin,
      printBackground: true,
    })

    return { buffer: Buffer.from(pdfBuffer), title }
  } finally {
    await page.close()
  }
}
