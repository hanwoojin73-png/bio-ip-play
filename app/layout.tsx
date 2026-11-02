import type { Metadata } from "next";
import localFont from "next/font/local";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const SITE_TITLE       = "HANiPLAY";
const SITE_DESCRIPTION = "AI보다 내가 먼저. 나의 초상·표정·몸짓·음성을 Bio-IP로.";

export const metadata: Metadata = {
  // Absolute base for OG/Twitter URLs. Kept on the existing deployment domain.
  metadataBase: new URL("https://bio-ip-play.vercel.app"),
  title:       SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type:        "website",
    locale:      "ko_KR",
    siteName:    SITE_TITLE,
    title:       SITE_TITLE,
    description: SITE_DESCRIPTION,
    url:         "/",
  },
  twitter: {
    card:        "summary",
    title:       SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavBar />
        {children}
      </body>
    </html>
  );
}
