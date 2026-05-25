import { NextRequest } from 'next/server'
import JSZip from 'jszip'
import { convertUrlToPdf, PdfOptions } from '@/lib/pdf-converter'
import { validateUrl } from '@/lib/url-validator'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

const BATCH_LIMIT_FREE = 5
const BATCH_LIMIT_PRO = 30
const CONCURRENCY = 3

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const current = index++
      try {
        results[current] = { status: 'fulfilled', value: await tasks[current]() }
      } catch (err) {
        results[current] = { status: 'rejected', reason: err }
      }
    }
  }

  const workers = Array.from({ length: limit }, worker)
  await Promise.all(workers)
  return results
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { urls, options } = body as { urls: string[]; options?: PdfOptions }

  if (!Array.isArray(urls) || urls.length === 0) {
    return Response.json({ error: 'urls 배열을 입력해 주세요.' }, { status: 400 })
  }

  const limit = user?.plan === 'PRO' ? BATCH_LIMIT_PRO : BATCH_LIMIT_FREE
  if (urls.length > limit) {
    return Response.json(
      { error: `한 번에 최대 ${limit}개의 URL을 변환할 수 있습니다.` },
      { status: 400 }
    )
  }

  const validUrls = urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .filter((u) => !validateUrl(u))

  if (validUrls.length === 0) {
    return Response.json({ error: '유효한 URL이 없습니다.' }, { status: 400 })
  }

  const zip = new JSZip()
  const usedNames = new Set<string>()

  const tasks = validUrls.map((url) => async () => {
    const { buffer, title } = await convertUrlToPdf(url, options)
    let baseName = (title || new URL(url).hostname)
      .replace(/[^a-zA-Z0-9가-힣\s-_]/g, '')
      .trim()
      .slice(0, 60) || 'page'

    // Deduplicate filenames
    let fileName = `${baseName}.pdf`
    let counter = 1
    while (usedNames.has(fileName)) {
      fileName = `${baseName}-${counter++}.pdf`
    }
    usedNames.add(fileName)

    zip.file(fileName, buffer)
  })

  await runWithConcurrency(tasks, CONCURRENCY)

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return new Response(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="websnap-batch-${Date.now()}.zip"`,
    },
  })
}
