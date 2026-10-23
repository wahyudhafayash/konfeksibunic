'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
        <h2 className="text-4xl font-black text-slate-800 mb-2">404</h2>
        <p className="text-slate-600 mb-6 font-medium">Halaman yang Anda cari tidak ditemukan.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-sky-200"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}
