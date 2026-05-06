import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Konfeksi Bunda Icha',
  description: 'Aplikasi manajemen konfeksi',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
