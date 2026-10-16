"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 「Google でログイン」ボタンから呼ばれる Server Action
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Google → Supabase の後に戻ってくる場所
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/?error=login_failed");
  }

  // Google のログイン画面へ移動する
  redirect(data.url);
}

// 「ログアウト」ボタンから呼ばれる Server Action
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// 「アカウントとデータを削除」から呼ばれる Server Action。
// 先に Storage に残っているタイムラインのファイルを消し、そのあとアカウントを消す
//（外出・行った県・便・友達・設定などは、データベースで一緒に消える）
export async function deleteMyAccount(): Promise<{
  ok: false;
  message: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { ok: false, message: "ログインし直してください。" };

  const { data: files } = await supabase.storage
    .from("timelines")
    .list(userId, { limit: 1000 });
  if (files && files.length > 0) {
    await supabase.storage
      .from("timelines")
      .remove(files.map((f) => `${userId}/${f.name}`));
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return {
      ok: false,
      message: "削除できませんでした。時間をおいてもう一度お試しください。",
    };
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
