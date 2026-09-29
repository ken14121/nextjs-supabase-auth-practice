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
