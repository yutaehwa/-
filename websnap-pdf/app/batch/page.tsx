'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'

type ItemStatus = 'pending' | 'done' | 'error'

type BatchItem = {
  url: string
  status: ItemStatus
}

export default function BatchPage() {
  const { data: session } = useSession()
  const [raw, setRaw] = useState('')
  const [items, setItems] = useState<BatchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [error, setError] = useState('')

  const isPro = (session as { user?: { plan?: string } } | null)?.user?.plan === 'PRO'
  const limit = isPro ? 30 : 5

  function parseUrls(text: string): string[] {
    return text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'))
  }

  async function handleBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!session) {
      signIn('google')
      return
    }

    const urls = parseUrls(raw)
    if (urls.length === 0) {
      setError('유효한 URL이 없습니다. 줄바꿈 또는 쉼표로 구분해 입력하세요.')
      return
    }

    setError('')
    setDownloadUrl('')
    setItems(urls.map((url) => ({ url, status: 'pending' })))
    setLoading(true)

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '일괄 변환 실패')
      }

      const blob = await res.blob()
      setDownloadUrl(URL.createObjectURL(blob))
      setItems((prev) => prev.map((it) => ({ ...it, status: 'done' })))
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setItems((prev) => prev.map((it) => ({ ...it, status: 'error' })))
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `websnap-batch-${Date.now()}.zip`
    a.click()
  }

  const urlCount = parseUrls(raw).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Back nav */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xl font-bold text-slate-800">
            WebSnap <span className="text-blue-600">PDF</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            대시보드 →
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">일괄 변환</h1>
          <p className="text-slate-500 text-sm mb-6">
            여러 URL을 한 번에 PDF로 변환해 ZIP 파일로 다운로드합니다.
            {session ? ` (최대 ${limit}개)` : ' (로그인 필요)'}
          </p>

          {!session && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              일괄 변환은 로그인 사용자만 사용할 수 있습니다.{' '}
              <button onClick={() => signIn('google')} className="underline font-medium">
                Google로 로그인
              </button>
            </div>
          )}

          <form onSubmit={handleBatch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                URL 목록{' '}
                <span className={`text-xs font-normal ${urlCount > limit ? 'text-red-500' : 'text-slate-400'}`}>
                  ({urlCount}/{limit}개)
                </span>
              </label>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={'https://example.com/article1\nhttps://example.com/article2\nhttps://example.com/article3'}
                rows={8}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800 placeholder-slate-400 text-sm font-mono transition disabled:bg-slate-50 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">줄바꿈 또는 쉼표(,)로 구분</p>
            </div>

            <button
              type="submit"
              disabled={loading || urlCount === 0 || urlCount > limit}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  변환 중... (최대 60초 소요)
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  ZIP으로 일괄 변환
                </>
              )}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Progress list */}
          {items.length > 0 && (
            <div className="mt-6 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    item.status === 'done'
                      ? 'bg-green-100 text-green-600'
                      : item.status === 'error'
                      ? 'bg-red-100 text-red-500'
                      : 'bg-slate-100'
                  }`}>
                    {item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : '·'}
                  </span>
                  <span className="text-slate-600 truncate">{item.url}</span>
                </div>
              ))}
            </div>
          )}

          {/* Download */}
          {downloadUrl && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">ZIP 생성 완료!</p>
                <p className="text-xs text-green-600">{items.length}개 PDF 포함</p>
              </div>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                ZIP 다운로드
              </button>
            </div>
          )}
        </div>

        {/* Pro upsell */}
        {session && !isPro && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 text-center">
            Pro 플랜은 최대 30개 URL을 동시에 변환할 수 있습니다.{' '}
            <Link href="/dashboard" className="underline font-medium">업그레이드 →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
