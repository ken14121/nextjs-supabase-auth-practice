# 学習ロードマップ

Zendash インターン（9/28 開始）の業務として、開始後の数日をかけて進める Web アプリ開発の計画です。
1 ステップずつ「動かす → 理解する → コミットする」を繰り返し、その日に進んだステップを日報で報告します。

報告ルール・作業時間の数え方・週報の書き方・前任者の記録から学んだことは [INTERNSHIP.md](INTERNSHIP.md) にまとめています。

### 1 日の流れ

1. Slack で「9/28(月)9:00在宅で業務開始します」と連絡する（在宅か学内かを書く）
2. その日の目標を決める（ステップ 1〜2 個分）
3. ステップを進める。詰まったら Slack で質問し、返信を待つ間は別の作業を進める
4. 作業の区切りでコミット・push する
5. 日報メモを書いてから、Slack で「17:30業務終了します」と連絡する
6. 金曜は週報（合計作業時間つき）をアップする

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

## 週ごとの目安（合計 約 225 時間 ≒ 6 週間）

| 週 | 進めるステップ | その週のゴール |
| --- | --- | --- |
| 1 週目 | Step 0〜3 + Jev の疎通確認 | Google ログインが動く。作るアプリの内容を Zendash に共有する |
| 2 週目 | Step 4〜5 | 自分の Timeline.json を取り込んで、訪問一覧が出る |
| 3 週目 | Step 6 | 検索・絞り込み・編集ができる |
| 4 週目 | Step 7 | Jev で訪問が自動分類される |
| 5 週目 | Step 8〜9 | テストが通り、GitHub Pages の紹介ページができる |
| 6 週目 | Step 10 + 総括レポート | Syllabuzz の改善提案と、引き継ぎ用の総括レポートを出す |

遅れても大丈夫です。遅れた週は、次の週の最初に「どこまで終わったか」を見直して調整します。

---

## ステップ一覧

各ステップの「完了条件」を満たしたらチェックを付けてコミットします。

### Step 0: 環境の準備

- [ ] Node.js 24 を入れる（`nvm` や `fnm` などのバージョン管理ツール推奨）
- [ ] `corepack enable` で Yarn を有効化し、`yarn set version 4.5.3`
- [ ] `.yarnrc.yml` に `nodeLinker: node-modules` を書く

- [ ] **Jev のアカウントを作り、公式のサンプルで API が 1 回呼べるか確認する**（前任者は外部 API の登録待ちで 2 週間以上止まったため、待ちが出るものは初日に始める）

**調べるキーワード:** corepack, Yarn Berry, nodeLinker, Plug'n'Play と node_modules の違い
**完了条件:** `node -v` が v24、`yarn -v` が 4.5.3 になり、Jev の API キーが手元にある

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
- [ ] RLS（行レベルセキュリティ）を有効にし、「自分の行だけ読める・書ける」ポリシーを書く（**テーブルを作ったらすぐ書く。後回しにしない**）
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

### Step 6: 一覧・検索・編集

- [ ] SWR で一覧を取得・再取得する
- [ ] react-hook-form + Zod で「メモ」や「カテゴリ」を編集するフォームを作る
- [ ] **検索バー**を付ける。何を検索しているか（例: 場所の名前とメモ）がプレースホルダーなどで分かるようにする
- [ ] 日付やカテゴリで絞り込めるようにする

**調べるキーワード:** SWR の `mutate`, `zodResolver`, 楽観的更新, Supabase の `ilike` / 全文検索
**完了条件:** 検索・絞り込みができ、編集して保存するとページを再読み込みしなくても一覧が更新される

### Step 7: Jev で訪問を分類する

- [ ] Jev の公式ドキュメントとクイックスタートを読む
- [ ] API キーを `.env.local` に置き、**サーバー側だけ**で呼ぶ
- [ ] 訪問 1 件を「仕事 / 食事 / 遊び / 移動 / その他」のどれかに分類させる
- [ ] 結果を `category` に保存して一覧に表示する
- [ ] 分類済みの訪問は Jev を呼び直さない（利用上限・料金の節約。動作確認で同じ入力を何度も送らない）

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

### Step 10: Syllabuzz の改善提案（余裕があれば）

- [ ] 大学生として Syllabuzz を実際に使い、分かりづらい所・離脱しそうな所をメモする
- [ ] 優先度を付けて改善案をまとめる（Zendash から指定されたフォーマットがあればそれに合わせる）
- [ ] さらに余裕があれば、コードで実際に修正する

**完了条件:** 優先度付きの改善案を Zendash に渡せる

---

## Claude Code との付き合い方

インターンのテーマ②にある「AI が出したものをそのまま使わず、理解してから採用する」の練習も兼ねます。

- 1 回に頼むのは **1 ステップ（またはその一部）だけ**にする
- 「コードを書いて」だけでなく「**なぜそうするのか説明して**」とも頼む
- 出てきた差分は自分で読み、分からない行は質問する
- 動作確認は自分の手でやる（ブラウザで触る・コマンドを打つ）
- 秘密情報（API キー、`.env.local`、実際の `Timeline.json`）は貼らない・コミットしない
