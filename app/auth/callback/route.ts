import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google でのログインが終わると、Supabase 経由でここに戻ってくる。
// URL に付いてくる一時的な `code` を、ログイン済みのセッション（Cookie）に交換する。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=login_failed`);
}
