import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";




const bebasNeue = localFont({
  src: "./fonts/bebas_neue/BebasNeue-Regular.ttf",
  variable: "--font-bebas",
});

const roboto = localFont({
  src: "./fonts/roboto/Roboto-Regular.ttf",
  variable: "--font-roboto",
});

const dash = localFont({
  src: "./fonts/dash/Dash-Horizon-Demo.otf",
  variable: "--font-dash",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yatta.dev"),
  title: {
    default: "YATTA — Your Backend. Inside Your App",
    template: "%s — YATTA",
  },
  description:
    "A production-grade backend framework for Bun. Database, auth, jobs, cache, storage, mail and realtime — embedded in your application process.",
  keywords: [
    "bun",
    "backend framework",
    "sqlite",
    "orm",
    "authentication",
    "job queue",
    "websocket",
    "serverless",
    "typescript",
  ],
  authors: [{ name: "Yatta" }],
  creator: "Yatta",
  openGraph: {
    type: "website",
    siteName: "YATTA",
    title: "YATTA — Your Backend. Inside Your App",
    description:
      "A production-grade backend framework for Bun. Database, auth, jobs, cache, storage, mail and realtime — embedded in your application process.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "YATTA — Your Backend. Inside Your App",
    description:
      "A production-grade backend framework for Bun. Database, auth, jobs, cache, storage, mail and realtime — embedded in your application process.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${roboto.variable} ${dash.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
