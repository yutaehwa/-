'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

type Plan = 'FREE' | 'PRO'

type Conversion = {
  id: string
  url: string
  title: string
  format: string
  createdAt: string
  storagePath: string | null
  expiresAt: string | null
}

type Props = {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    plan: Plan
  }
  conversions: Conversion[]
  todayCount: number
  justUpgraded: boolean
}

const FREE_LIMIT = 5

export default function DashboardClient({ user, conversions: initial, todayCount, justUpgraded }: Props) {
  const [conversions, setConversions] = useState<Conversion[]>(initial)
  const [upgrading, setUpgrading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (justUpgraded) {
      setTimeout(() => {
        window.history.replaceState({}, '', '/dashboard')
      }, 3000)
    }
  }, [justUpgraded])

  // Fetch signed download URLs
  useEffect(() => {
    async function loadUrls() {
      const res = await fetch('/api/history')
      if (!res.ok) return
      const { items } = await res.json()
      const map: Record<string, string> = {}
      for (const item of items) {
        if (item.downloadUrl) map[item.id] = item.downloadUrl
      }
      setSignedUrls(map)
    }
    loadUrls()
  }, [])

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setUpgrading(false)
    }
  }

  async function handleManagePlan() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setUpgrading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setConversions((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const remaining = Math.max(0, FREE_LIMIT - todayCount)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Upgrade banner */}
      {justUpgraded && (
        <div className="bg-blue-600 text-white text-center py-3 text-sm font-medium">
          Pro 업그레이드 완료! 이제 무제한으로 변환할 수 있습니다.
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-slate-800">
          WebSnap <span className="text-blue-600">PDF</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user.image && (
              <Image src={user.image} alt="" width={32} height={32} className="rounded-full" />
            )}
            <span className="text-sm text-slate-600 hidden sm:block">{user.name || user.email}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Plan Card */}
        <div className={`rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          user.plan === 'PRO'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
            : 'bg-white border border-slate-200'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                user.plan === 'PRO' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
              }`}>
                {user.plan === 'PRO' ? 'PRO' : 'FREE'}
              </span>
              <h2 className={`font-semibold ${user.plan === 'PRO' ? 'text-white' : 'text-slate-800'}`}>
                {user.plan === 'PRO' ? 'Pro 플랜 사용 중' : '무료 플랜'}
              </h2>
            </div>
            {user.plan === 'FREE' ? (
              <p className="text-sm text-slate-500">
                오늘 {todayCount}/{FREE_LIMIT}회 사용 · 남은 횟수 <strong className="text-slate-700">{remaining}회</strong>
              </p>
            ) : (
              <p className="text-sm text-white/80">무제한 변환 · PDF 1년 보관</p>
            )}
          </div>
          {user.plan === 'FREE' ? (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              {upgrading ? '처리 중...' : 'Pro로 업그레이드 — $9/월'}
            </button>
          ) : (
            <button
              onClick={handleManagePlan}
              disabled={upgrading}
              className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              구독 관리
            </button>
          )}
        </div>

        {/* Quick Convert Button */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">변환 히스토리</h3>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + 새 변환
          </Link>
        </div>

        {/* History Table */}
        {conversions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">변환 내역이 없습니다.</p>
            <Link href="/" className="mt-4 inline-block text-blue-600 text-sm font-medium hover:underline">
              첫 번째 PDF를 만들어 보세요
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">제목</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium hidden sm:table-cell">형식</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium hidden md:table-cell">변환일</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium hidden md:table-cell">만료일</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-800 font-medium hover:text-blue-600 line-clamp-1 block max-w-xs"
                        title={c.title}
                      >
                        {c.title || c.url}
                      </a>
                      <span className="text-xs text-slate-400 truncate block max-w-xs">{c.url}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell">{c.format}</td>
                    <td className="px-5 py-3 text-slate-500 hidden md:table-cell">
                      {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden md:table-cell">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2 justify-end">
                        {signedUrls[c.id] ? (
                          <a
                            href={signedUrls[c.id]}
                            download
                            className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors"
                          >
                            다운로드
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 px-3 py-1.5">만료됨</span>
                        )}
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="text-xs px-2 py-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="삭제"
                        >
                          {deletingId === c.id ? '...' : '✕'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
