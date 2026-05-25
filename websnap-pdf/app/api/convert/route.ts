import { NextRequest } from 'next/server'
import { convertUrlToPdf } from '@/lib/pdf-converter'
import { validateUrl } from '@/lib/url-validator'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { url, options } = body as {
    url: string
    options?: { format?: string; orientation?: string; margin?: string }
  }

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL을 입력해 주세요.' }, { status: 400 })
  }

  const validationError = validateUrl(url)
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 })
  }

  try {
    const { buffer, title } = await convertUrlToPdf(url, options)

    const safeName = (title || 'page')
      .replace(/[^a-zA-Z0-9가-힣\s-_]/g, '')
      .trim()
      .slice(0, 80) || 'page'

    const fileName = `${safeName}.pdf`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'X-File-Name': fileName,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '변환 중 오류가 발생했습니다.'
    return Response.json({ error: message }, { status: 500 })
  }
}
