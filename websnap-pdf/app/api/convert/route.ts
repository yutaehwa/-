import { NextRequest } from 'next/server'
import { convertUrlToPdf } from '@/lib/pdf-converter'
import { validateUrl } from '@/lib/url-validator'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { uploadPdf } from '@/lib/storage'

export const maxDuration = 60

// Anonymous users get a simple IP-based limit (3/day)
const anonIpCounts = new Map<string, { count: number; date: string }>()
const ANON_DAILY_LIMIT = 3

function checkAnonLimit(ip: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const entry = anonIpCounts.get(ip)
  if (!entry || entry.date !== today) {
    anonIpCounts.set(ip, { count: 1, date: today })
    return true
  }
  if (entry.count >= ANON_DAILY_LIMIT) return false
  entry.count++
  return true
}

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

  // Auth check
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (userId) {
    const { allowed, remaining } = await checkRateLimit(userId)
    if (!allowed) {
      return Response.json(
        { error: `오늘 변환 횟수(${5}회)를 모두 사용했습니다. Pro로 업그레이드하면 무제한 사용 가능합니다.` },
        { status: 429 }
      )
    }
    // Pass remaining count to client via header
    void remaining
  } else {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    if (!checkAnonLimit(ip)) {
      return Response.json(
        { error: `비로그인 사용자는 하루 ${ANON_DAILY_LIMIT}회까지 변환할 수 있습니다. 로그인하면 5회로 늘어납니다.` },
        { status: 429 }
      )
    }
  }

  try {
    const { buffer, title } = await convertUrlToPdf(url, options)

    const safeName = (title || 'page')
      .replace(/[^a-zA-Z0-9가-힣\s-_]/g, '')
      .trim()
      .slice(0, 80) || 'page'

    const fileName = `${safeName}.pdf`

    // Save history for logged-in users
    if (userId) {
      try {
        const conversion = await prisma.conversion.create({
          data: {
            userId,
            url,
            title: title || 'Untitled',
            format: options?.format || 'A4',
            orientation: options?.orientation || 'portrait',
            margin: options?.margin || 'normal',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for free
          },
        })

        // Upload PDF to Supabase Storage
        const storagePath = await uploadPdf(userId, conversion.id, buffer)
        await prisma.conversion.update({
          where: { id: conversion.id },
          data: { storagePath },
        })
      } catch {
        // Storage errors shouldn't block the PDF download
      }
    }

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
