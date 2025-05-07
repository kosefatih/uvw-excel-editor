import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Excel Makro Kontrol",
  description: "Excel dosyalarını işlemek için web uygulaması",
}

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
