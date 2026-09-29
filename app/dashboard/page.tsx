import { LogOut, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
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

// ログインしている人だけが見られるページ
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // proxy.ts でも弾いているが、ページ側でも必ず確認する
  if (!claims) {
    redirect("/");
  }

  const name = claims.user_metadata?.full_name ?? "名前未設定";

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserRound className="size-6" />
            マイページ
          </CardTitle>
          <CardDescription>
            Google アカウントでログインしています。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">名前</dt>
            <dd>{name}</dd>
            <dt className="text-muted-foreground">メール</dt>
            <dd>{claims.email}</dd>
          </dl>
        </CardContent>
        <CardFooter>
          <form action={signOut} className="w-full">
            <Button type="submit" variant="outline" className="w-full">
              <LogOut />
              ログアウト
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
