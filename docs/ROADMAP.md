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

## 作るもの

**今までの旅を振り返り、友人と「行った県・国」を比べるアプリ**（名前は未定）

Google マップのタイムライン（スマホから書き出した `Timeline.json`）を取り込み、過去の旅行をまとめて振り返ります。

> 9/28 に Zendash（ゆうへいさん）へ方向性を共有し、「その方向で作ってみてください」と了承済み。3D 描画は必要なら three.js を使うと良い、とのアドバイスあり。

**作る理由**: 友人と経県値で競ったり、日帰り旅行の記録を共有したりするのが好きなため。将来は世界一周をしたいので、行った国や移動を 3D の地球儀で見られたら面白い。

### 最低限の機能（これができたら完成）

1. Timeline.json をアップロードすると、行った都道府県・国が地図で塗られる
2. Jev が外出を 1 回ずつ判定し、旅行だけを「旅の一覧」にまとめる
3. 友人とつながり、行った県を比べられる（共通の県 / 自分だけが行った県 / 制覇率）

### Travy などとの違い

| | Travy（旅行 SNS） | このアプリ |
| --- | --- | --- |
| 記録 | これから手で投稿する | 過去の履歴をまとめて取り込む。手入力なし |
| 旅行かどうか | 自分で選んで投稿する | Jev が「旅行か日常か」を判定する |
| 共有 | 誰にでも公開 | 友人だけと、県・国の単位で比較する |

### 決めたこと

- **場所の細かさ**: 都道府県と国だけ。外部 API は使わず、境界データ（GeoJSON）で緯度経度から判定する
- **自宅の扱い**: 自宅（`semanticType: "Home"`）の周り 1〜2 km は取り込まない（記録は最寄り駅のあたりから始まる）
- **共有範囲**: 友人に見せるのは「どの県・国に行ったか」だけ。細かい位置は本人しか見られない
- **画像は使わない**: 軽さ優先で、文字と地図だけで表現する
- **Jev の使い道**: 外出 1 回ごとに Choice で「旅行 / 帰省 / 日帰りのお出かけ / 日常」を判定する（距離・泊数・移動手段はコードで計算してから渡す。Jev は計算が苦手なため）

### やりたいことリスト（最低限の機能が終わってから）

- [x] 行った国を **3D の地球儀**で表示し、ぐるぐる回せる → 疑似 Google Earth（`/map3d`）として実装。three.js を直接使う代わりに、地図用の WebGL ライブラリ **MapLibre GL JS** を使った（地球儀 → 日本 → 地理院の標高タイルで山が立体に → PLATEAU の 3D ビル、と拡大していける。API キー不要）
- [x] **日本地図と世界地図を切り替え**られるようにする（マイページの 2D 地図のタブ）
- 行った県を **3D で立体表示**（行った回数で高さを変えるなど）
- 旅ごとのメモ
- 友達追加を **QR コードの読み取り**でもできるようにする（フレンドコードを QR にする）
- 友人とのランキング
- **よく行く場所（学校・バイト先）を登録**して、自宅と同じように旅行の判定から外し、友達にも見せない

> Google ログインをしても、マップの訪問履歴は API では取れません（2024 年以降、タイムラインはスマホ本体にだけ保存される仕組みに変わったため）。
> そのため「スマホで書き出したファイルを読み込む」方式にしています。

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
| 2 週目 | Step 4〜5 | 自分の Timeline.json を取り込んで、行った県・国の一覧が出る |
| 3 週目 | Step 6 | 地図で県・国が塗られ、友人と比較できる |
| 4 週目 | Step 7 | Jev で外出が判定され、旅の一覧ができる |
| 5 週目 | Step 8〜9 | テストが通り、GitHub Pages の紹介ページができる |
| 6 週目 | Step 10 + 総括レポート | Syllabuzz の改善提案と、引き継ぎ用の総括レポートを出す |

遅れても大丈夫です。遅れた週は、次の週の最初に「どこまで終わったか」を見直して調整します。

---

## ステップ一覧

各ステップの「完了条件」を満たしたらチェックを付けてコミットします。

### Step 0: 環境の準備

- [x] Node.js 24 を入れる（`nvm` や `fnm` などのバージョン管理ツール推奨）
- [x] `corepack enable` で Yarn を有効化し、`corepack use yarn@4.5.3`
- [x] `.yarnrc.yml` に `nodeLinker: node-modules` を書く
- [x] Jev のアカウントを作成（新規登録の一時停止でクレジットが付かず、Zendash 側で対応してもらうことに）
- [ ] **Jev のアカウントを作り、公式のサンプルで API が 1 回呼べるか確認する**（前任者は外部 API の登録待ちで 2 週間以上止まったため、待ちが出るものは初日に始める）

**調べるキーワード:** corepack, Yarn Berry, nodeLinker, Plug'n'Play と node_modules の違い
**完了条件:** `node -v` が v24、`yarn -v` が 4.5.3 になり、Jev の API キーが手元にある

### Step 1: Next.js を動かす

- [x] Next.js 16 のプロジェクトを作成（App Router / TypeScript）
- [x] `tsconfig.json` の `strict: true` を確認
- [x] ESLint の代わりに Biome 2.4 を入れて `yarn lint` / `yarn format` を使えるようにする（`biome.json` で `css.parser.tailwindDirectives` を有効化）
- [x] React を指定バージョン 19.2.5 にそろえる（作成時は 19.2.4 が入る）
- [x] トップページの文字を自分で書き換えてみる

**調べるキーワード:** App Router, `layout.tsx` と `page.tsx`, Server Components と Client Components の違い
**完了条件:** `yarn dev` で http://localhost:3000 が開き、`yarn lint` がエラーなしで通る

### Step 2: 見た目を整える

- [x] Tailwind CSS 4 を設定（Next.js の作成時に選べる）
- [x] shadcn/ui を初期化し、`Button` と `Card` を追加（component library は **Radix UI** を選ぶ。プロジェクトのフォルダの中で実行すること）
- [x] lucide-react のアイコンをボタンに付けてみる
- [x] shadcn が作ったコードを `yarn biome check --write` で Biome の書き方にそろえる

**調べるキーワード:** Tailwind 4 の `@import "tailwindcss"`、shadcn/ui はライブラリではなく「コードをコピーして使う」仕組み、Radix UI との関係
**完了条件:** shadcn/ui のボタンが画面に出る

### Step 3: Supabase と Google ログイン（今回のメイン）

- [x] Supabase でプロジェクトを作成（Data API: ON / 新しいテーブルの自動公開: OFF / 自動 RLS: ON）
- [x] Google Cloud Console で OAuth クライアント ID を作る（同意画面はテスト中・外部。テストユーザーに自分を追加）
- [x] Supabase の Auth 設定で Google プロバイダを有効にする（URL Configuration: Site URL と Redirect URLs に localhost:3000）
- [x] `@supabase/supabase-js` と `@supabase/ssr` を入れる
- [x] `.env.local` に URL と anon key を書く（**`.env.local` は絶対にコミットしない**）
- [x] サーバー用 / ブラウザ用の Supabase クライアントを作る（`lib/supabase/`）
- [x] `proxy.ts` でセッションを更新する処理を書く
- [x] ログインボタン → Google → 戻ってきたらユーザー名を表示（9/29 動作確認）
- [x] ログアウトボタン
- [x] ログインしていないと入れないページ（例: `/dashboard`）を作る

**調べるキーワード:** OAuth 2.0 の流れ、コールバック URL、Cookie とセッション、Next.js 16 の `proxy.ts`（旧 `middleware.ts`）、Route Handler, Server Actions
**完了条件:** Google でログイン・ログアウトができ、未ログインで `/dashboard` を開くとログイン画面に戻される

### Step 4: データベースと RLS

- [x] テーブルを設計する（`supabase/migrations/20260930000000_create_travel_tables.sql`）
  - `profiles`（名札）: `display_name`, `friend_code`（8 文字。ログイン時に自動作成）
  - `outings`（外出 1 回分）: 開始・終了日時, `nights`, `distance_km`, `main_transport`, `label`（Jev の判定）, `memo`
  - `visited_regions`（行った県・国）: `region_code`（JP-13 / US など）, `outing_id`, `visited_on`（日付）
  - `friendships`（友達申請）: `requester_id`, `addressee_id`, `status`（pending / accepted）
  - 友達探しはフレンドコード方式。友達には「行った県・国と日付」を見せる（日常・未判定の外出は除く）
- [x] RLS（行レベルセキュリティ）を有効にし、「自分の行だけ読める・書ける」ポリシーを書く（**テーブルを作ったらすぐ書く。後回しにしない**）
- [x] 新しいテーブルは自動では API に公開されない設定なので、使うテーブルごとに `authenticated` ロールへ権限を付ける（例: `grant select, insert, update, delete on table outings to authenticated;`）。付け忘れると `permission denied` になる
- [x] Supabase CLI を入れて `link` し、`yarn supabase db push` でマイグレーションを反映する
- [x] Supabase CLI で型を生成し（`supabase gen types typescript`）、コードで使う
- [x] DB の行を画面に表示する（マイページに profiles の表示名とフレンドコード）

**調べるキーワード:** RLS, `auth.uid()`, マイグレーション, Supabase CLI
**完了条件:** 別の Google アカウントでログインすると、他人のデータが見えない（友人になった相手の `visited_regions` だけは見える）

### Step 5: Timeline.json の取り込み

- [x] 自分の `Timeline.json` の中身を観察する
- [x] **実データはリポジトリに入れない**（`.gitignore` に `Timeline*.json`）
- [x] ブラウザで滞在と移動だけを取り出して小さくし（`lib/timeline/parse.ts`）、Supabase Storage の `timelines` バケットに置く
- [x] サーバー（`app/import/actions.ts`）で Zod を使ってもう一度チェックし、外出に区切って `outings` と `visited_regions` に保存。元ファイルは取り込み後に削除
- [x] 自宅の周り 1.5 km の点を捨てる（`lib/timeline/outings.ts`）
- [x] 緯度経度から都道府県・国を判定する（`lib/geo/regions.ts`。境界 TopoJSON と点の内外判定。海沿いは 15 km 以内の一番近い地域）
- [x] 「家を出てから戻るまで」を 1 回の外出として区切る。泊数は日本時間 3:00 をまたいだ回数
- [x] `yarn supabase db push` と `yarn gen:types` を実行し、自分の Timeline.json で動作確認する（9/30：約 2 年分 → 外出 382 件・25 都道府県）
- [ ] Android で書き出したファイル（友人のもの）で動作確認する

**ファイルの形（iPhone で書き出したもの）**
- 配列で、要素は `visit`（滞在）/ `activity`（移動。`in train` `walking` `in passenger vehicle` など）/ `timelinePath`（軌跡）の 3 種類
- 数字はすべて文字列（例: `"0.627897"`）、位置は `"geo:35.69,140.04"` 形式
- 時刻は `+09:00` と UTC（`Z`）が混ざっている
- 場所の名前は入っていない（`placeID` だけ）
- Android で書き出したファイルは形が違うので、友人のファイルで確認する

**調べるキーワード:** Supabase Storage のバケットとポリシー, Zod の `safeParse`, GeoJSON, point in polygon（`@turf/boolean-point-in-polygon`）
**完了条件:** ファイルを選んでアップロードすると、行った県・国の一覧が表示される

### Step 6: 地図・友人との比較

- [x] 行った県・国を塗った地図を表示する（2D。日本 / 世界をタブで切り替え。行った日数で 4 段階に塗り分け。沖縄は左上の枠に表示）
- [ ] SWR で一覧を取得・再取得する
- [x] 昔の旅を手で追加・編集・削除できるようにする（`/trips`。react-hook-form + Zod。日付・県/国・種類・メモ。取り込み直しても消えない）
- [x] 友人申請・承認の画面を作る（`/friends`。フレンドコードで申請 → 承認 / 断る / 取り消す / 友達をやめる。react-hook-form + Zod）
- [x] 友人と比較する画面を作る（`/friends/[id]`。どちらも / 自分だけ / 友達だけ を 3 色で塗った地図、制覇率、一覧）
- [x] 本物の 2 アカウントで、申請 → 承認 → 比較までを試す（10/2、サブアカウント＋架空データで確認）
- [x] **検索バー**を付ける（`/trips`。「県・国の名前、メモの文字から」と範囲を表示）

**調べるキーワード:** SWR の `mutate`, `zodResolver`, 地図の SVG 表示, RLS で「友人だけに見せる」ポリシー
**完了条件:** 友人のアカウントとつながり、行った県を比べられる

### Step 7: Jev で外出を判定する

- [x] Jev の公式ドキュメントとクイックスタートを読む（公式 SDK `@typesafe-ai/sdk` の README と型定義）
- [x] API キーを `.env.local` に置き、**サーバー側だけ**で呼ぶ（`lib/jev/classify.ts` に `import "server-only"`）
- [x] 外出 1 回を Choice で「旅行 / 帰省 / 日帰りのお出かけ / 日常」のどれかに判定させる（行った県・泊数・移動距離・移動手段・時期を渡す）
- [x] 結果を `label` に保存し、旅行だけを「旅の一覧」に表示する（`/trips`。県・国の名前とメモで探せる検索バー付き）
- [x] 判定材料に「その行き先に過去どれくらい行っているか」も渡す（学校に泊まり込んだ日などを「日常」と判定させるため）
- [x] 判定済みの外出は Jev を呼び直さない（`label` が空のものだけ、1 回 20 件ずつ。本人が直した判定は上書きしない）
- [ ] 本物の API キーで判定を試し、結果を見て質問文を調整する

> Jev は公開されたばかりなので、AI（Claude Code など）は正しい使い方をまだ知らない可能性が高いです。
> Claude Code に頼むときは、**公式ドキュメントの URL かクイックスタートの内容を一緒に渡す**こと。
> 出てきたコードは公式ドキュメントと見比べて確認します。

**完了条件:** アップロードすると、旅行だけが「旅の一覧」に並ぶ

### Step 8: テスト

- [x] Playwright を入れる（`playwright.config.ts`。e2e のサーバーにはダミーの Supabase を渡し、本物の DB には触らない）
- [x] 「トップページが表示される」「未ログインだと `/dashboard` に入れない」の 2 本を書く（ログインが必要な 6 ページすべて・書き出し方ページ・ログイン失敗の表示も。計 9 本）
- [x] 計算部分のテスト（`yarn test:unit`、19 本）：判定の流れ、サンプルデータの取り込み・いつもの場所・ルールで日常、Jev に渡す中身、友達との比較、正解率、手入力の旅のチェック
- [ ] （余裕があれば）GitHub Actions で `yarn lint` と Playwright を自動実行する

**完了条件:** `yarn test:e2e` が通る

### Step 9: ポートフォリオにまとめる

- [ ] GitHub Pages で紹介ページを作る（何を作ったか / 技術構成 / Jev をどう使ったか / 苦労したこと / スクリーンショット）
- [ ] 個人情報（位置情報・メールアドレス）が写り込んでいないか確認する
- [ ] （10/9 予定）`/map3d` に「写真 / 線」の切り替えを付ける：遠くでは細い線だけのモノクロの地球儀（行った国だけ差し色）、近づくと PLATEAU の建物が白〜グレーで建ち上がる。紹介ページの表紙にも使う

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
- 秘密情報（API キー、`.env.local`、実際の `Timeline.json`）はコミットしない
