import { ArrowLeft, BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Google マップのタイムラインを書き出す手順（iPhone）。
// ログインしていない人（これから使う友達）も読めるように、保護しないページにしている。

const STEPS = [
  {
    image: "/guide/iphone-1.webp",
    text: "Google マップのアプリを開き、右上の自分のアイコンをタップします。",
  },
  {
    image: "/guide/iphone-2.webp",
    text: "メニューの「タイムライン」をタップします。",
  },
  {
    image: "/guide/iphone-3.webp",
    text: "タイムラインの画面で、右上の「…」をタップします。",
  },
  {
    image: "/guide/iphone-4.webp",
    text: "「位置情報とプライバシーの設定」をタップします。",
  },
  {
    image: "/guide/iphone-5.webp",
    text: "「タイムライン データをエクスポート」をタップします。",
  },
] as const;

export default function GuidePage() {
  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <BookOpen className="size-6" />
              タイムラインの書き出し方（iPhone）
            </CardTitle>
            <CardDescription className="[word-break:auto-phrase]">
              Google マップのアプリから Timeline.json
              を書き出し、このアプリで取り込むまでの手順です。
              タイムラインがオフになっていた期間の記録は残っていません。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-8">
              {STEPS.map((step, index) => (
                <li key={step.image} className="flex flex-col gap-3">
                  <p className="flex items-baseline gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span>{step.text}</span>
                  </p>
                  <Image
                    src={step.image}
                    alt={`手順 ${index + 1} の画面`}
                    width={920}
                    height={2000}
                    className="mx-auto h-auto w-full max-w-64 rounded-xl border"
                  />
                </li>
              ))}
              <li className="flex flex-col gap-3">
                <p className="flex items-baseline gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {STEPS.length + 1}
                  </span>
                  <span className="[word-break:auto-phrase]">
                    保存先を選ぶ画面が出たら、Timeline.json
                    を「ファイル」アプリや iCloud Drive に保存し、AirDrop
                    などでパソコンに送ります。
                  </span>
                </p>
              </li>
              <li className="flex flex-col gap-3">
                <p className="flex items-baseline gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {STEPS.length + 2}
                  </span>
                  <span className="[word-break:auto-phrase]">
                    このアプリにログインし、マイページの「タイムラインを取り込む」から
                    Timeline.json を選びます。
                  </span>
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground [word-break:auto-phrase]">
          Timeline.json
          には自宅などの位置情報が入っています。取り込みに使ったあとは、人に送ったり公開したりしないでください。
        </p>

        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>
      </div>
    </main>
  );
}
