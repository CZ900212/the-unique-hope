import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import localFont from "next/font/local";

import { LocaleProvider } from "~/components/locale-provider";
import { getMessages } from "~/lib/i18n";
import { getServerLocale } from "~/server/server-locale";
import { TRPCReactProvider } from "~/trpc/react";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10b981",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const messages = getMessages(locale);

  return {
    title: messages.common.appName,
    description:
      locale === "zh"
        ? "The Unique Hope 稀望俱乐部：面向罕见病教育支持的角色化教学、报名与进度追踪平台。"
        : "A learning platform for The Unique Hope with role-based teaching, registrations, and progress tracking for rare-disease education support.",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
  };
}

const manropeDisplay = localFont({
  src: [
    {
      path: "../../public/fonts/Manrope-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Manrope-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

const manropeBody = localFont({
  src: [
    {
      path: "../../public/fonts/Manrope-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Manrope-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

const frauncesTitle = localFont({
  src: [
    {
      path: "../../public/fonts/Fraunces-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Fraunces-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-title",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      className={`${manropeDisplay.variable} ${manropeBody.variable} ${frauncesTitle.variable}`}
    >
      <body>
        <LocaleProvider locale={locale}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
