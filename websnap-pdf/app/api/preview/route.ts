import { NextRequest } from 'next/server'
import { captureScreenshot } from '@/lib/pdf-converter'
import { validateUrl } from '@/lib/url-validator'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { url } = body as { url: string }

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL을 입력해 주세요.' }, { status: 400 })
  }

  const validationError = validateUrl(url)
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 })
  }

  try {
    const imageBuffer = await captureScreenshot(url)

    return new Response(imageBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '미리보기 생성 실패'
    return Response.json({ error: message }, { status: 500 })
  }
}
