import { NextRequest } from 'next/server'
import { convertUrlToPdf } from '@/lib/pdf-converter'
import { validateUrl } from '@/lib/url-validator'
import { hashApiKey } from '@/lib/api-key'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Authenticate via API key
  const authHeader = request.headers.get('authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!apiKey) {
    return Response.json(
      { error: 'Authorization 헤더에 Bearer API_KEY를 포함해 주세요.' },
      { status: 401 }
    )
  }

  const keyRecord = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(apiKey) },
    include: { user: { select: { id: true, plan: true } } },
  })

  if (!keyRecord) {
    return Response.json({ error: '유효하지 않은 API 키입니다.' }, { status: 401 })
  }

  const { allowed } = await checkRateLimit(keyRecord.user.id)
  if (!allowed) {
    return Response.json(
      { error: '일일 변환 한도를 초과했습니다. Pro 플랜으로 업그레이드하세요.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 JSON 형식입니다.' }, { status: 400 })
  }

  const { url, options } = body as {
    url: string
    options?: {
      format?: string
      orientation?: string
      margin?: string
      watermark?: string
    }
  }

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'url 필드가 필요합니다.' }, { status: 400 })
  }

  const validationError = validateUrl(url)
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 })
  }

  try {
    const { buffer, title } = await convertUrlToPdf(url, options)

    // Update lastUsed timestamp
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() },
    })

    // Save to history
    await prisma.conversion.create({
      data: {
        userId: keyRecord.user.id,
        url,
        title: title || 'Untitled',
        format: options?.format || 'A4',
        orientation: options?.orientation || 'portrait',
        margin: options?.margin || 'normal',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const safeName = (title || 'page')
      .replace(/[^a-zA-Z0-9가-힣\s-_]/g, '')
      .trim()
      .slice(0, 80) || 'page'

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '.pdf')}`,
        'X-Title': encodeURIComponent(title),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '변환 중 오류가 발생했습니다.'
    return Response.json({ error: message }, { status: 500 })
  }
}
