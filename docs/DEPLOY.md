# 公開の手順（Vercel）

アプリ本体は Vercel に置く（ログイン・Server Actions などサーバーで動く処理があるので、GitHub Pages では動かない）。
紹介ページ（静的なページ）は GitHub Pages に置き、そこからアプリにリンクする。

公開した URL：**https://nextjs-supabase-auth-practice.vercel.app**（10/19 に公開。`main` に push すると自動で更新される）

> Vercel・Supabase・Google の画面の名前や場所は変わることがある。見つからないときは、それぞれの公式ドキュメントで確かめる。

## 0. 公開の前にコードで済ませたこと（10/16）

- トップページ（何ができるか・位置情報の扱い）と、プライバシーのページ（`/privacy`）
- 「アカウントとデータを削除」（わたしの地図帳のいちばん下）
- Jev は `JEV_OWNER_USER_IDS` に書いた人（本人）だけ。ほかの人はアプリのルールで判定する

## 1. main にまとめる

今までの作業は `claude/dreamy-euler-flpzg9` ブランチにある。`main` には最初のコミットしか無いので、
GitHub で `main` への Pull Request を作り、中身を確かめてからマージする。Vercel は `main` を本番として公開する。

## 2. Supabase：データベースを最新にする

```
yarn supabase db push
```

本番も、今使っている Supabase のプロジェクトをそのまま使う（データは RLS で人ごとに分かれている）。

## 3. Vercel にプロジェクトを作る

1. Vercel に GitHub でログインし、「Add New → Project」から `nextjs-supabase-auth-practice` を選ぶ
2. Framework は Next.js（自動で選ばれる）
3. 環境変数（Environment Variables）を入れる

| 名前 | 値 | 備考 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` と同じ | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` と同じ | publishable キー。`sb_secret_` / service_role は**絶対に入れない** |
| `JEV_API_KEY` | `.env.local` と同じ | 無くても動く（全員ルールで判定） |
| `JEV_OWNER_USER_IDS` | 自分のユーザー ID | Supabase の Authentication → Users で確認。無ければだれも Jev を使わない |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | Yarn 4（`package.json` の `packageManager`）を使うため |

4. Node.js のバージョンを 24 にする（Project Settings → General → Node.js Version）
5. Deploy。`https://（プロジェクト名）.vercel.app` のような URL ができる

## 4. Supabase：ログインの戻り先に本番の URL を足す

Authentication → URL Configuration

- Site URL：`https://（プロジェクト名）.vercel.app`
- Redirect URLs：`https://（プロジェクト名）.vercel.app/**` を足す（`http://localhost:3000/**` は残す）

## 5. Google：だれでもログインできるようにする

Google Cloud Console → Google Auth Platform（OAuth 同意画面）

1. アプリのホームページに `https://（プロジェクト名）.vercel.app`、プライバシーポリシーに `https://（プロジェクト名）.vercel.app/privacy` を入れる
   - 「承認済みドメイン」に `nextjs-supabase-auth-practice.vercel.app` を足す（`vercel.app` はみんなで共有しているドメインなので、自分のサイトの部分まで書く）。Supabase のドメインは消さない
   - ロゴは上げない（上げると Google の審査が必要になる）
2. 公開ステータスを「テスト中」から「本番環境」にする（「対象」の画面）
   - 使うのは名前・メールアドレスなどの基本的な情報だけなので、通常は審査がいらない
3. 「承認済みのリダイレクト URI」は Supabase のコールバック（`https://（Supabase のプロジェクト）.supabase.co/auth/v1/callback`）のままでよい（変えない）

## 6. 公開したあとに確かめる

- [ ] トップページとプライバシーのページが、ログインしなくても開ける
- [ ] Google でログインでき、わたしの地図帳に戻ってくる
- [ ] Timeline.json を取り込める（数分かかることがある）
- [ ] 自分のアカウントでは「Jev で 20 件判定」、サブアカウントでは「判定する」と出る
- [ ] サブアカウントで「アカウントとデータを削除」ができ、トップページに「削除しました」と出る
- [ ] スクリーンショットに、メールアドレス・フレンドコード・細かい場所が写っていない

## 気をつけること

- `JEV_OWNER_USER_IDS` は**自分の UID 1 つだけ**にする。空にしておくと、自分も含めてだれも Jev を使わない（安全側に倒れる）。
  `JEV_API_KEY` は `NEXT_PUBLIC_` が付かないのでサーバーの中だけで読まれ、ほかの人には見えない。ほかの人の判定はルールに切り替わり、クレジットは減らない
- Vercel のプロジェクトにほかの人をメンバーとして招待しない（メンバーは環境変数の画面でキーを見られる）
- Vercel の「Optional Integrations」にある Supabase の「Add」は押さない（新しい Supabase のプロジェクトが別にできてしまう。今のプロジェクトをそのまま使う）
- Supabase の無料プランは、しばらく使われないとプロジェクトが止まる（止まったら Supabase の画面から再開する）
- Vercel の無料プラン（Hobby）は個人の非商用向け
- 知らない人の位置情報を預かることになる。困ったことが起きたら、Google の公開ステータスを「テスト中」に戻せば、テストユーザーに登録した人以外はログインできなくなる
