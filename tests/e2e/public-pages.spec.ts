import { expect, test } from "@playwright/test";

// ログインしていない人から見た画面

test("トップページが表示され、Google でログインのボタンがある", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("旅の記録アプリ")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Google でログイン" }),
  ).toBeVisible();
});

test("ログインに失敗して戻ってきたら、エラーを表示する", async ({ page }) => {
  await page.goto("/?error=login_failed");
  await expect(page.getByText("ログインできませんでした")).toBeVisible();
});

test("書き出し方のページは、ログインしなくても見られる", async ({ page }) => {
  await page.goto("/guide");
  await expect(page).toHaveURL(/\/guide$/);
});

// ログインが必要なページは、トップページに戻される
for (const path of [
  "/dashboard",
  "/import",
  "/trips",
  "/map3d",
  "/friends",
  "/outings/review",
]) {
  test(`ログインしていないと ${path} に入れない`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(
      page.getByRole("button", { name: "Google でログイン" }),
    ).toBeVisible();
  });
}
