import { LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";
import { signInWithGoogle } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_NAME_LATIN } from "@/lib/app-name";
import { createClient } from "@/lib/supabase/server";

// ログイン前のトップページ。だれでも見られるので、何ができるか・位置情報をどう扱うかを先に伝える

const FEATURES = [
  {
    title: "履歴をまとめて取り込む",
    text: "Google マップのタイムラインを書き出して読み込むだけ。手で入力しなくても、行った都道府県・国・市区町村が地図帳になります。",
  },
  {
    title: "旅だけを切符にする",
    text: "外出を「旅行・帰省・日帰り・おでかけ・日常」に分け、旅は 1 回ずつ切符に。飛行機は搭乗券、新幹線は特急券の形で、自分で飾れます。",
  },
  {
    title: "友達と比べる",
    text: "フレンドコードでつながった友達と、行った県・国を地図で比べられます。見せるのは、旅で行った県・国と日付だけです。",
  },
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, deleted } = await searchParams;

  // ログインしているかどうかを、サーバー側で確認する
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3 border-b-2 border-ink pb-6">
        <p className="text-xs tracking-[0.3em] text-muted-foreground">
          {APP_NAME_LATIN}
        </p>
        <h1 className="font-serif text-4xl font-semibold">{APP_NAME}</h1>
        <p className="font-serif text-xl">行った場所が、地図帳になる。</p>
        <p className="text-sm text-muted-foreground">
          今までの旅をふり返り、友達と行った県や国を比べるアプリです。
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {/* 自分のコールバック（login_failed）でも、Supabase から戻ってきたエラー
            （例: bad_oauth_state = ログインの途中で時間が経ちすぎた）でも出す */}
        {error && (
          <p className="text-sm text-destructive">
            ログインできませんでした。もう一度お試しください。
          </p>
        )}
        {deleted && (
          <p role="status" className="text-sm">
            アカウントとデータを削除しました。ご利用ありがとうございました。
          </p>
        )}
        {isLoggedIn ? (
          <Button asChild className="w-full sm:w-fit">
            <Link href="/dashboard">
              <LayoutDashboard />
              わたしの地図帳へ
            </Link>
          </Button>
        ) : (
          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full sm:w-fit">
              <LogIn />
              Google でログイン
            </Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          ログインすると、
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            プライバシーと使い方の約束
          </Link>
          に同意したものとします。
        </p>
      </div>

      <section className="flex flex-col gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-1 border-t border-rule pt-3"
          >
            <h2 className="font-serif text-lg font-semibold">{f.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {f.text}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 border-t-2 border-ink pt-4 text-sm">
        <h2 className="font-serif text-lg font-semibold">位置情報の扱い</h2>
        <p className="leading-relaxed">
          位置の座標（緯度・経度）は保存しません。タイムラインのファイルはブラウザで小さくしてから送り、県や市区町村を調べ終えたらすぐに消します。記録は基本的に自分だけが見られ、いつでもすべて削除できます。
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-vermilion"
          >
            プライバシーと使い方の約束
          </Link>
          <Link
            href="/guide"
            className="underline underline-offset-4 hover:text-vermilion"
          >
            タイムラインの書き出し方
          </Link>
        </div>
      </section>
    </main>
  );
}
