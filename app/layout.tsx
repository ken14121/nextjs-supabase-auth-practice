import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { APP_NAME } from "@/lib/app-name";
import "./globals.css";

// 見出しと数字は明朝、本文はゴシック（docs/design/DECISIONS.md の 3-1・3-2）。
// 日本語のフォントは大きいので、先読み（preload）はせず、使う文字の分だけ読み込ませる
const shippori = Shippori_Mincho({
  weight: ["500", "600", "700"],
  variable: "--font-shippori",
  preload: false,
});

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  variable: "--font-zen-kaku",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s ｜ ${APP_NAME}` },
  description:
    "Google マップのタイムラインから、行った都道府県・国を地図帳のように記録するアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${shippori.variable} ${zenKaku.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
