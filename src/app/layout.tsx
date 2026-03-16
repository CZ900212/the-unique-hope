import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter, Source_Serif_4, Space_Grotesk } from "next/font/google";

import { LocaleProvider } from "~/components/locale-provider";
import { getMessages } from "~/lib/i18n";
import { getServerLocale } from "~/server/locale";
import { TRPCReactProvider } from "~/trpc/react";

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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-title",
  weight: ["400", "500", "600", "700"],
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${sourceSerif4.variable} ${spaceGrotesk.variable}`}>
      <body>
        <LocaleProvider locale={locale}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
