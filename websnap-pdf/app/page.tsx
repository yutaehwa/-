'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'

type PdfOption = {
  format: 'A4' | 'Letter'
  orientation: 'portrait' | 'landscape'
  margin: 'none' | 'small' | 'normal' | 'large'
}

type Step = 'idle' | 'preview' | 'converting' | 'done' | 'error'

const STEPS = [
  { key: 'preview', label: '페이지 접속' },
  { key: 'converting', label: '본문 추출' },
  { key: 'done', label: 'PDF 생성' },
]

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step)
}

export default function Home() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [previewSrc, setPreviewSrc] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [options, setOptions] = useState<PdfOption>({
    format: 'A4',
    orientation: 'portrait',
    margin: 'normal',
  })

  function reset() {
    setStep('idle')
    setErrorMessage('')
    setPreviewSrc('')
    setDownloadUrl('')
    setFileName('')
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    reset()
    setStep('preview')

    try {
      // 1단계: 미리보기 스크린샷
      const previewRes = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      })

      if (previewRes.ok) {
        const blob = await previewRes.blob()
        setPreviewSrc(URL.createObjectURL(blob))
      }

      // 2단계: 본문 추출 & PDF 변환
      setStep('converting')

      const convertRes = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl, options }),
      })

      if (!convertRes.ok) {
        const data = await convertRes.json()
        throw new Error(data.error || '변환 중 오류가 발생했습니다.')
      }

      const pdfBlob = await convertRes.blob()
      const name = convertRes.headers.get('X-File-Name') || 'page.pdf'
      setDownloadUrl(URL.createObjectURL(pdfBlob))
      setFileName(name)
      setStep('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류')
      setStep('error')
    }
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    a.click()
  }

  const isLoading = step === 'preview' || step === 'converting'
  const currentStepIndex = stepIndex(step)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-1">
              WebSnap <span className="text-blue-600">PDF</span>
            </h1>
            <p className="text-slate-500">
              URL을 입력하면 웹 페이지를 PDF로 저장해 드립니다
            </p>
          </div>
          <div className="flex-shrink-0">
            {session ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-sm font-medium text-slate-700 transition-colors shadow-sm"
              >
                {session.user?.image && (
                  <Image src={session.user.image} alt="" width={24} height={24} className="rounded-full" />
                )}
                대시보드
              </Link>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-sm font-medium text-slate-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google로 로그인
              </button>
            )}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleConvert} className="space-y-6">
            {/* URL Input */}
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
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800 placeholder-slate-400 transition disabled:bg-slate-50"
              />
            </div>

            {/* Options */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">용지 크기</label>
                <select
                  value={options.format}
                  onChange={(e) => setOptions({ ...options, format: e.target.value as PdfOption['format'] })}
                  disabled={isLoading}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50"
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
                  disabled={isLoading}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50"
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
                  disabled={isLoading}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50"
                >
                  <option value="none">없음</option>
                  <option value="small">좁게</option>
                  <option value="normal">보통</option>
                  <option value="large">넓게</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  처리 중...
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

          {/* Progress Steps */}
          {step !== 'idle' && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-6">
                {STEPS.map((s, i) => {
                  const isDone = step === 'done' || currentStepIndex > i
                  const isActive = !isDone && currentStepIndex === i
                  const isPending = currentStepIndex < i && step !== 'done'

                  return (
                    <div key={s.key} className="flex-1 flex flex-col items-center relative">
                      {/* Connector line */}
                      {i < STEPS.length - 1 && (
                        <div className={`absolute top-4 left-1/2 w-full h-0.5 transition-colors ${isDone ? 'bg-blue-500' : 'bg-slate-200'}`} />
                      )}
                      {/* Circle */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all ${
                        isDone
                          ? 'bg-blue-500 text-white'
                          : isActive
                          ? 'bg-blue-100 border-2 border-blue-500 text-blue-600'
                          : isPending && step === 'error'
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {isDone ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isActive ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <span className="text-xs font-semibold">{i + 1}</span>
                        )}
                      </div>
                      <span className={`text-xs mt-1.5 font-medium ${isDone || isActive ? 'text-slate-700' : 'text-slate-400'}`}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Preview Thumbnail */}
              {previewSrc && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">페이지 미리보기</p>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <Image
                      src={previewSrc}
                      alt="페이지 미리보기"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                </div>
              )}

              {/* Done: Download */}
              {step === 'done' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4">
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
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      다운로드
                    </button>
                    <button
                      onClick={reset}
                      className="px-3 py-2 text-green-700 hover:bg-green-100 text-sm rounded-lg transition-colors"
                    >
                      초기화
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {step === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800">변환 실패</p>
                    <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
                  </div>
                  <button
                    onClick={reset}
                    className="text-red-500 hover:text-red-700 text-xs underline flex-shrink-0"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          {session
            ? '변환 히스토리는 대시보드에서 확인할 수 있습니다'
            : '로그인하면 변환 내역 저장 및 PDF 재다운로드가 가능합니다'}
        </p>
      </div>
    </main>
  )
}
