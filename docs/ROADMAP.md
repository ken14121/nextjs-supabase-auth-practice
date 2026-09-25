# 学習ロードマップ

Zendash インターン（9/28 開始）の業務として、開始後の数日をかけて進める Web アプリ開発の計画です。
1 ステップずつ「動かす → 理解する → コミットする」を繰り返し、その日に進んだステップを日報で報告します。

### 1 日の流れ

1. Slack で「始めます」と連絡する
2. ロードマップのステップを進める（その日の目標を 1〜2 ステップに決める）
3. 詰まったら Slack で質問する（返信は夜になることもあるので、待つ間は別の作業を進める）
4. 作業の区切りでコミット・push する
5. Slack で「終わります」の連絡と日報を送る

## 作るもの（仮）

**訪問記録アプリ（visit-log）**

- Google ログインでサインイン
- Google マップのタイムライン（スマホから手動エクスポートした `Timeline.json`）をアップロード
- 訪問地を一覧・地図などで見られる（自分のデータだけ）
- Jev で各訪問を「仕事 / 食事 / 遊び / 移動」などに自動分類
- 最後に GitHub Pages で「こう作った・Jev をこう使った」を紹介してポートフォリオにする

> Google ログインをしても、マップの訪問履歴は API では取れません（2024 年以降、タイムラインはスマホ本体にだけ保存される仕組みに変わったため）。
> そのため「スマホでエクスポートしたファイルを読み込む」方式にしています。

## 技術スタック（指定）

| 分類 | 使うもの |
| --- | --- |
| Runtime / Package | Node.js 24 / Yarn 4.5.3（`.yarnrc.yml` は `nodeLinker: node-modules`） |
| Frontend | Next.js 16.2.3 / React 19.2.5 / App Router（`app/`）/ `proxy.ts` |
| 言語 | TypeScript 5.9（`strict: true`）/ DB の型は Supabase の生成型 |
| UI | Tailwind CSS 4 / Radix UI / shadcn/ui / lucide-react |
| フォーム・状態 | react-hook-form / Zod / SWR |
| Backend | Supabase（PostgreSQL 15 / Auth / Storage） |
| 品質 | Biome 2.4 / Playwright |
| AI | Jev |

---

## ステップ一覧

各ステップの「完了条件」を満たしたらチェックを付けてコミットします。

### Step 0: 環境の準備

- [ ] Node.js 24 を入れる（`nvm` や `fnm` などのバージョン管理ツール推奨）
- [ ] `corepack enable` で Yarn を有効化し、`yarn set version 4.5.3`
- [ ] `.yarnrc.yml` に `nodeLinker: node-modules` を書く

**調べるキーワード:** corepack, Yarn Berry, nodeLinker, Plug'n'Play と node_modules の違い
**完了条件:** `node -v` が v24、`yarn -v` が 4.5.3 になる

### Step 1: Next.js を動かす

- [ ] Next.js 16 のプロジェクトを作成（App Router / TypeScript）
- [ ] `tsconfig.json` の `strict: true` を確認
- [ ] ESLint の代わりに Biome 2.4 を入れて `yarn lint` / `yarn format` を使えるようにする
- [ ] トップページの文字を自分で書き換えてみる

**調べるキーワード:** App Router, `layout.tsx` と `page.tsx`, Server Components と Client Components の違い
**完了条件:** `yarn dev` で http://localhost:3000 が開き、`yarn lint` がエラーなしで通る

### Step 2: 見た目を整える

- [ ] Tailwind CSS 4 を設定（Next.js の作成時に選べる）
- [ ] shadcn/ui を初期化し、`Button` と `Card` を追加
- [ ] lucide-react のアイコンをボタンに付けてみる

**調べるキーワード:** Tailwind 4 の `@import "tailwindcss"`、shadcn/ui はライブラリではなく「コードをコピーして使う」仕組み、Radix UI との関係
**完了条件:** shadcn/ui のボタンが画面に出る

### Step 3: Supabase と Google ログイン（今回のメイン）

- [ ] Supabase でプロジェクトを作成
- [ ] Google Cloud Console で OAuth クライアント ID を作る
- [ ] Supabase の Auth 設定で Google プロバイダを有効にする
- [ ] `@supabase/supabase-js` と `@supabase/ssr` を入れる
- [ ] `.env.local` に URL と anon key を書く（**`.env.local` は絶対にコミットしない**）
- [ ] サーバー用 / ブラウザ用の Supabase クライアントを作る
- [ ] `proxy.ts` でセッションを更新する処理を書く
- [ ] ログインボタン → Google → 戻ってきたらユーザー名を表示
- [ ] ログアウトボタン
- [ ] ログインしていないと入れないページ（例: `/dashboard`）を作る

**調べるキーワード:** OAuth 2.0 の流れ、コールバック URL、Cookie とセッション、Next.js 16 の `proxy.ts`（旧 `middleware.ts`）、Route Handler, Server Actions
**完了条件:** Google でログイン・ログアウトができ、未ログインで `/dashboard` を開くとログイン画面に戻される

### Step 4: データベースと RLS

- [ ] `visits`（訪問）テーブルを設計する（例: `id`, `user_id`, `place_name`, `lat`, `lng`, `started_at`, `ended_at`, `category`）
- [ ] RLS（行レベルセキュリティ）を有効にし、「自分の行だけ読める・書ける」ポリシーを書く
- [ ] Supabase CLI で型を生成し（`supabase gen types typescript`）、コードで使う
- [ ] 手で 1 件入れて、画面に表示する

**調べるキーワード:** RLS, `auth.uid()`, マイグレーション, Supabase CLI
**完了条件:** 別の Google アカウントでログインすると、他人のデータが見えない

### Step 5: Timeline.json の取り込み

- [ ] スマホから自分の `Timeline.json` をエクスポートして中身を観察する
- [ ] **実データはリポジトリに入れない**（`.gitignore` に追加、テスト用には一部を加工したサンプルを作る）
- [ ] Supabase Storage にアップロードする
- [ ] Zod でファイルの形をチェックしながらパースし、`visits` に保存する（Server Action か Route Handler）

**調べるキーワード:** Supabase Storage のバケットとポリシー, Zod の `safeParse`, ファイルアップロード
**完了条件:** ファイルを選んでアップロードすると、訪問一覧が表示される

### Step 6: 一覧・編集を使いやすくする

- [ ] SWR で一覧を取得・再取得する
- [ ] react-hook-form + Zod で「メモ」や「カテゴリ」を編集するフォームを作る
- [ ] 日付で絞り込む、など簡単な機能を 1 つ足す

**調べるキーワード:** SWR の `mutate`, `zodResolver`, 楽観的更新
**完了条件:** 編集して保存すると、ページを再読み込みしなくても一覧が更新される

### Step 7: Jev で訪問を分類する

- [ ] Jev の公式ドキュメントとクイックスタートを読む
- [ ] API キーを `.env.local` に置き、**サーバー側だけ**で呼ぶ
- [ ] 訪問 1 件を「仕事 / 食事 / 遊び / 移動 / その他」のどれかに分類させる
- [ ] 結果を `category` に保存して一覧に表示する

> Jev は公開されたばかりなので、AI（Claude Code など）は正しい使い方をまだ知らない可能性が高いです。
> Claude Code に頼むときは、**公式ドキュメントの URL かクイックスタートの内容を一緒に渡す**こと。
> 出てきたコードは公式ドキュメントと見比べて確認します。

**完了条件:** アップロードした訪問に自動でカテゴリが付く

### Step 8: テスト

- [ ] Playwright を入れる
- [ ] 「トップページが表示される」「未ログインだと `/dashboard` に入れない」の 2 本を書く
- [ ] （余裕があれば）GitHub Actions で `yarn lint` と Playwright を自動実行する

**完了条件:** `yarn test:e2e` が通る

### Step 9: ポートフォリオにまとめる

- [ ] GitHub Pages で紹介ページを作る（何を作ったか / 技術構成 / Jev をどう使ったか / 苦労したこと / スクリーンショット）
- [ ] 個人情報（位置情報・メールアドレス）が写り込んでいないか確認する

**完了条件:** 紹介ページの URL を人に見せられる

---

## Claude Code との付き合い方

インターンのテーマ②にある「AI が出したものをそのまま使わず、理解してから採用する」の練習も兼ねます。

- 1 回に頼むのは **1 ステップ（またはその一部）だけ**にする
- 「コードを書いて」だけでなく「**なぜそうするのか説明して**」とも頼む
- 出てきた差分は自分で読み、分からない行は質問する
- 動作確認は自分の手でやる（ブラウザで触る・コマンドを打つ）
- 秘密情報（API キー、`.env.local`、実際の `Timeline.json`）は貼らない・コミットしない

## 日報テンプレート（Slack 用）

```
【日報】M/D
■ 作業時間: 10:00〜17:00（うち学校 / コクーン / 自宅）
■ やったこと
- 
■ 分かったこと・学んだこと
- 
■ 詰まっていること・質問
- 
■ 次にやること
- 
```

## メモ（面談で聞いたこと）

- フルリモート。ただし 1/3 は学校で作業、**週 1 回は必ずコクーン**で作業
- 作業の開始・終了は Zendash の Slack で連絡する（「始めます」「終わります」）
- 時間は自分で管理する。日報は Slack で毎日（大まかで OK）
- Slack は昼間つながりにくく、返信は夜になることもある
- 業務が始まったら、連絡にはきちんと反応する
- 9/28 の開始前に「こんなものを作って」という指示が来る予定（内容は自由、技術は多少指定あり。この計画は指示が来たら合わせて直す）
- 余裕があれば Syllabuzz の改善案をユーザー目線でまとめる → さらに余裕があればコードで修正
