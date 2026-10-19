// Supabase の接続情報を .env.local から読み込む。
// 書き忘れていたら、分かりやすいエラーで止める。
// NEXT_PUBLIC_ で始まる環境変数はブラウザ向けのコードに埋め込まれるため、
// process.env.〇〇 と名前を直接書く必要がある（process.env[name] の形では読めない）。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function getSupabaseEnv() {
  if (!url || !publishableKey) {
    throw new Error(
      ".env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を設定してください（.env.example を参照）",
    );
  }
  return { url, publishableKey };
}
