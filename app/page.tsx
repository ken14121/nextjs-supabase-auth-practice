import { Globe, LayoutDashboard, LogIn, MapPinned } from "lucide-react";
import Link from "next/link";
import { signInWithGoogle } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await searchParams;

  // ログインしているかどうかを、サーバー側で確認する
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Globe className="size-6" />
            旅の記録アプリ（準備中）
          </CardTitle>
          <CardDescription className="[word-break:auto-phrase]">
            今までの旅行を振り返って、
            <br />
            友達と行った県や国を比べられるアプリです。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinned className="size-4" />
            Google マップの履歴から、行った都道府県・国を集計します。
          </p>
          {error === "login_failed" && (
            <p className="text-sm text-destructive">
              ログインできませんでした。もう一度お試しください。
            </p>
          )}
        </CardContent>
        <CardFooter>
          {isLoggedIn ? (
            <Button asChild className="w-full">
              <Link href="/dashboard">
                <LayoutDashboard />
                マイページへ
              </Link>
            </Button>
          ) : (
            <form action={signInWithGoogle} className="w-full">
              <Button type="submit" className="w-full">
                <LogIn />
                Google でログイン
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
