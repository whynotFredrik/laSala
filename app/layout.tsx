import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"

import { InstallPrompt } from "@/components/marketing/install-prompt"
import { RegisterSW } from "@/components/marketing/register-sw"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lasalastudio.ro"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Lasala Fitness Studio",
    template: "%s · Lasala Fitness Studio",
  },
  description:
    "Aplicație de rezervări și abonamente pentru Lasala Fitness Studio, Oradea.",
  applicationName: "Lasala Fitness Studio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lasala",
  },
  openGraph: {
    type: "website",
    siteName: "Lasala Fitness Studio",
    locale: "ro_RO",
  },
  formatDetection: {
    telephone: true,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
          <InstallPrompt />
          <RegisterSW />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
