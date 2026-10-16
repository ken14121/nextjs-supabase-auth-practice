import { defineConfig, devices } from "@playwright/test";

// テストの設定。
//   unit … 計算の部分（判定の流れ・いつもの場所・比較・正解率など）。ブラウザも DB も使わない
//   e2e  … ブラウザで画面を開いて確かめる。テスト用に Next.js を別のポートで起動する
//
// e2e のサーバーには、ダミーの Supabase の接続先を渡す（本物の DB や Jev には触らない）。
// ログインが必要な画面は「ログインしていないと入れないこと」だけを確かめる。

const PORT = 3100;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  projects: [
    {
      name: "unit",
      testMatch: "unit/**/*.spec.ts",
    },
    {
      name: "e2e",
      testMatch: "e2e/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${PORT}`,
        // ふだんは `yarn playwright install chromium` で入れたブラウザを使う。
        // 別の場所のブラウザを使いたいときだけ、PW_CHROMIUM_PATH で指定する
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `yarn next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_dummy",
      JEV_API_KEY: "",
    },
  },
});
