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
  metadataBase: new URL("https://yatta.js.org"),
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
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "YATTA — Your Backend. Inside Your App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YATTA — Your Backend. Inside Your App",
    description:
      "A production-grade backend framework for Bun. Database, auth, jobs, cache, storage, mail and realtime — embedded in your application process.",
    images: ["/og-image.jpg"],
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Yatta JS",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  description:
    "A production-grade backend framework for Bun. Database, auth, jobs, cache, storage, mail and realtime — embedded in your application process.",
  url: "https://yatta.js.org",
  codeRepository: "https://github.com/psrockstar098/yatta.js",
  programmingLanguage: "TypeScript",
  author: {
    "@type": "Person",
    name: "Dominic Rockson",
    url: "https://github.com/psrockstar098",
  },
  offers: {
    "@type": "Offer",
    price: "0",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${roboto.variable} ${dash.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
