'use client'

import { useState } from 'react'

type PdfOption = {
  format: 'A4' | 'Letter'
  orientation: 'portrait' | 'landscape'
  margin: 'none' | 'small' | 'normal' | 'large'
}

type ConvertStatus = 'idle' | 'loading' | 'done' | 'error'

export default function Home() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<ConvertStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [options, setOptions] = useState<PdfOption>({
    format: 'A4',
    orientation: 'portrait',
    margin: 'normal',
  })

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setStatus('loading')
    setErrorMessage('')
    setDownloadUrl('')

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), options }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '변환 중 오류가 발생했습니다.')
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const name = res.headers.get('X-File-Name') || 'page.pdf'
      setDownloadUrl(objectUrl)
      setFileName(name)
      setStatus('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    a.click()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            WebSnap <span className="text-blue-600">PDF</span>
          </h1>
          <p className="text-slate-500 text-lg">
            URL을 입력하면 웹 페이지를 PDF로 저장해 드립니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleConvert} className="space-y-6">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-2">
                웹 페이지 URL
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800 placeholder-slate-400 transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">용지 크기</label>
                <select
                  value={options.format}
                  onChange={(e) => setOptions({ ...options, format: e.target.value as PdfOption['format'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">방향</label>
                <select
                  value={options.orientation}
                  onChange={(e) => setOptions({ ...options, orientation: e.target.value as PdfOption['orientation'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="portrait">세로</option>
                  <option value="landscape">가로</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">여백</label>
                <select
                  value={options.margin}
                  onChange={(e) => setOptions({ ...options, margin: e.target.value as PdfOption['margin'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="none">없음</option>
                  <option value="small">좁게</option>
                  <option value="normal">보통</option>
                  <option value="large">넓게</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  PDF 변환 중...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PDF로 변환하기
                </>
              )}
            </button>
          </form>

          {status === 'done' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">변환 완료!</p>
                  <p className="text-xs text-green-600 truncate max-w-xs">{fileName}</p>
                </div>
              </div>
              <button
                onClick={handleDownload}
                className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                다운로드
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">변환 실패</p>
                <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          로그인 없이 무료로 사용할 수 있습니다 · 1일 5회 제한
        </p>
      </div>
    </main>
  )
}
