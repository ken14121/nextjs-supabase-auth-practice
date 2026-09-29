import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Client Components（"use client" のファイル）で使う Supabase クライアント。
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
