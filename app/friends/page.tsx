import { ArrowLeft, ChevronRight, Inbox, Send, Users } from "lucide-react";
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
import { AddFriendForm } from "./add-friend-form";
import { CopyCodeButton } from "./copy-code-button";
import {
  IncomingRequestButtons,
  RemoveFriendshipButton,
} from "./friendship-buttons";

export const metadata = { title: "友達" };

// 友達の一覧と、友達申請（送る・届いた・送った）
export default async function FriendsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/");

  // RLS で、自分が関係する申請と、その相手のプロフィールしか返ってこない
  const [{ data: me }, { data: friendships }] = await Promise.all([
    supabase.from("profiles").select("friend_code").eq("id", userId).single(),
    supabase
      .from("friendships")
      .select("requester_id, addressee_id, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const rows = (friendships ?? []).map((f) => ({
    otherId: f.requester_id === userId ? f.addressee_id : f.requester_id,
    sentByMe: f.requester_id === userId,
    status: f.status,
  }));
  const otherIds = rows.map((r) => r.otherId);
  const { data: profiles } =
    otherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", otherIds)
      : { data: [] };
  const nameOf = (id: string) =>
    profiles?.find((p) => p.id === id)?.display_name || "名前未設定";

  const friends = rows
    .filter((r) => r.status === "accepted")
    .sort((a, b) => nameOf(a.otherId).localeCompare(nameOf(b.otherId), "ja"));
  const incoming = rows.filter((r) => r.status === "pending" && !r.sentByMe);
  const outgoing = rows.filter((r) => r.status === "pending" && r.sentByMe);

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="size-6" />
              友達
            </CardTitle>
            <CardDescription>
              フレンドコードを交換してつながると、おたがいの「行った県・国と日付」を比べられます。家の場所や日常の外出は見せません。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">
                あなたのフレンドコード
              </span>
              <span className="font-mono text-lg tracking-widest">
                {me?.friend_code ?? "--------"}
              </span>
              {me?.friend_code && <CopyCodeButton code={me.friend_code} />}
            </div>
            <AddFriendForm />
          </CardContent>
        </Card>

        {incoming.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-5" />
                届いた申請
                <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                  {incoming.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {incoming.map((r) => (
                  <li
                    key={r.otherId}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <span className="font-medium">{nameOf(r.otherId)}</span>
                    <IncomingRequestButtons requesterId={r.otherId} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              友達一覧
              <span className="text-sm font-normal text-muted-foreground">
                {friends.length} 人
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length > 0 ? (
              <ul className="divide-y text-sm">
                {friends.map((r) => (
                  <li
                    key={r.otherId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/friends/${r.otherId}`}
                      className="-mx-2 flex flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 font-medium hover:bg-muted"
                    >
                      {nameOf(r.otherId)}
                      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        行った場所を比べる
                        <ChevronRight className="size-4" />
                      </span>
                    </Link>
                    <RemoveFriendshipButton
                      otherId={r.otherId}
                      label="友達をやめる"
                      confirmText={`${nameOf(r.otherId)}さんと友達をやめますか？`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだ友達はいません。フレンドコードを教えあって、申請してみましょう。
              </p>
            )}
          </CardContent>
        </Card>

        {outgoing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-5" />
                送った申請
              </CardTitle>
              <CardDescription>
                相手が承認すると友達になります。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {outgoing.map((r) => (
                  <li
                    key={r.otherId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      {nameOf(r.otherId)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        承認待ち
                      </span>
                    </span>
                    <RemoveFriendshipButton
                      otherId={r.otherId}
                      label="取り消す"
                      confirmText="申請を取り消しますか？"
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>
      </div>
    </main>
  );
}
