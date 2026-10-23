import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Konfeksi Bunda Icha',
  description: 'Aplikasi manajemen konfeksi',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined') {
                  var origFetch = window.fetch;
                  var _f = origFetch;
                  Object.defineProperty(window, 'fetch', {
                    get: function() { return _f; },
                    set: function(val) { _f = val; },
                    configurable: true,
                    enumerable: true
                  });
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
