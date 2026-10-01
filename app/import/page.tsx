import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FileUp className="size-6" />
            タイムラインの取り込み
          </CardTitle>
          <CardDescription className="[word-break:auto-phrase]">
            スマホの Google マップから書き出した Timeline.json を選ぶと、
            外出ごとに区切って、行った都道府県・国を記録します。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ImportForm userId={claims.sub} />
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>自宅から 1.5km 以内の場所は記録しません。</li>
            <li>
              アップロードしたファイルは、取り込みが終わるとすぐに削除します。
            </li>
            <li>同じファイルを取り込み直しても、外出は重複しません。</li>
          </ul>
          <Link
            href="/guide"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            Timeline.json の書き出し方（iPhone）
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            マイページに戻る
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
