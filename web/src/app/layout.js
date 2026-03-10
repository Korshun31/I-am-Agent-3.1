import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  )
}
