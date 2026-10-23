'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
        <h2 className="text-3xl font-black text-rose-600 mb-2">Terjadi Kesalahan</h2>
        <p className="text-slate-600 mb-6 font-medium text-sm">
          {error?.message || 'Maaf, terjadi gangguan saat memuat aplikasi.'}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-sky-200"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
