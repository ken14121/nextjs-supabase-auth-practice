import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata = { title: "プライバシーと使い方の約束" };

// プライバシーポリシーと、使い方の約束。ログインしていない人も読める（proxy.ts で保護しない）。
// 書いてあることとアプリの作りがずれないように、データを足したり、外のサービスを使い始めたりしたら、ここも直す

const REPOSITORY = "https://github.com/ken14121/nextjs-supabase-auth-practice";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-rule pt-4">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-3xl font-semibold">
          プライバシーと使い方の約束
        </h1>
        <p className="text-sm text-muted-foreground">
          {APP_NAME}
          は、学生が臨地実務実習で作った、個人の旅の記録アプリです。位置情報を扱うので、何を保存し、だれに見えるのかをここにまとめます。
        </p>
      </header>

      <Section title="保存するもの">
        <ul className="list-disc pl-5">
          <li>
            Google
            でログインしたときの、名前とメールアドレス。メールアドレスはほかの人には見せません。名前は「表示名」として、友達と、あなたのフレンドコードを入力した人に見えます
          </li>
          <li>
            取り込んだタイムラインから分かる、外出ごとの日時・泊数・移動した距離・主な移動手段
          </li>
          <li>
            行った都道府県・国・市区町村と、その日付。空港・新幹線の駅のコードと時刻
          </li>
          <li>「いつもの場所にいた時間」など、判定のために数えた数字</li>
          <li>自分で入力した旅・メモ・切符の飾り・判定の設定</li>
        </ul>
      </Section>

      <Section title="保存しないもの">
        <ul className="list-disc pl-5">
          <li>
            <b>位置の座標（緯度・経度）は保存しません。</b>
            タイムラインのファイルはブラウザで小さくしてから送り、県や市区町村を調べ終えたら、すぐに消します。
          </li>
          <li>
            搭乗券のバーコードは、写真もふくめてこの端末の中で読むだけです。名前と予約番号は送らず、保存もしません。
          </li>
        </ul>
      </Section>

      <Section title="だれに見えるか">
        <ul className="list-disc pl-5">
          <li>記録は、基本的に自分だけが見られます。</li>
          <li>
            友達になった人（お互いにフレンドコードで申請・承認した人）には、表示名と、旅行・帰省・日帰りの外出で行った都道府県・国とその日付だけが見えます（日常・おでかけは見えません）。
          </li>
          <li>市区町村・切符・メモ・判定の設定は、友達にも見えません。</li>
        </ul>
      </Section>

      <Section title="使っている外のサービス">
        <ul className="list-disc pl-5">
          <li>Google（ログイン）</li>
          <li>Supabase（ログインとデータの保存）</li>
          <li>Vercel（このサイトを動かすサーバー）</li>
          <li>
            外出の種類（旅行・日常など）の判定は、アプリの中のルールで行います。作った本人のアカウントだけは、TypeSafe
            AI の Jev（判定用の AI）も使います。ほかの利用者のデータは Jev
            には送りません。
          </li>
        </ul>
      </Section>

      <Section title="データを消すには">
        <p>
          ログインして「わたしの地図帳」の一番下にある「アカウントとデータを削除」から、アカウントとすべてのデータを消せます。元に戻すことはできません。
        </p>
      </Section>

      <Section title="使い方の約束">
        <ul className="list-disc pl-5">
          <li>
            自分のタイムラインだけを取り込んでください。ほかの人の位置情報を、その人の同意なく取り込まないでください。
          </li>
          <li>
            学生の作品なので、予告なく内容を変えたり、公開をやめたりすることがあります。大事な記録は、元のタイムラインのファイルも手元に残しておいてください。
          </li>
        </ul>
      </Section>

      <Section title="問い合わせ">
        <p>
          <a
            href={`${REPOSITORY}/issues`}
            className="underline underline-offset-4 hover:text-vermilion"
          >
            GitHub のリポジトリ（Issues）
          </a>
          から連絡してください。
        </p>
      </Section>

      <p className="text-xs text-muted-foreground">
        最終更新：2026 年 10 月 16 日
      </p>
      <Link
        href="/"
        className="w-fit text-sm underline underline-offset-4 hover:text-vermilion"
      >
        トップへ戻る
      </Link>
    </main>
  );
}
