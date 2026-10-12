import { redirect } from "next/navigation";
import { type OutingLabel, TRAVEL_LABELS } from "@/lib/outings/labels";
import { createClient } from "@/lib/supabase/server";
import { AtlasView } from "./atlas-view";

export const metadata = { title: "わたしの地図帳" };

// 地図帳の「最近の旅」に出す種類（日常は出さない。docs/design/DECISIONS.md の 5-3）
const INDEX_LABELS: OutingLabel[] = [...TRAVEL_LABELS, "outing"];
const INDEX_SIZE = 8;

// わたしの地図帳（マイページ）。行った県の数と地図を主役にし、
// カードではなく罫線と余白で区切る（docs/design/DECISIONS.md の 4-1・5-1〜5-6）
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // proxy.ts でも弾いているが、ページ側でも必ず確認する
  if (!claims) {
    redirect("/");
  }

  // どれも RLS があるので、自分の行しか返ってこない
  const [
    { data: profile },
    { data: regions },
    { count: outingCount },
    { count: tripCount },
    { count: pendingCount },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, friend_code")
      .eq("id", claims.sub)
      .single(),
    supabase.rpc("get_my_regions"),
    supabase.from("outings").select("id", { count: "exact", head: true }),
    supabase
      .from("outings")
      .select("id", { count: "exact", head: true })
      .in("label", [...TRAVEL_LABELS]),
    supabase
      .from("outings")
      .select("id", { count: "exact", head: true })
      .is("label", null)
      .eq("source", "timeline"),
    supabase
      .from("outings")
      .select(
        "id, started_at, ended_at, nights, label, visited_regions(region_code)",
      )
      .in("label", INDEX_LABELS)
      .order("started_at", { ascending: false })
      .limit(INDEX_SIZE),
  ]);

  const name =
    profile?.display_name || claims.user_metadata?.full_name || "名前未設定";

  return (
    <AtlasView
      name={name}
      friendCode={profile?.friend_code ?? null}
      regions={regions ?? []}
      outingCount={outingCount ?? 0}
      tripCount={tripCount ?? 0}
      pendingCount={pendingCount ?? 0}
      recent={recent ?? []}
    />
  );
}
