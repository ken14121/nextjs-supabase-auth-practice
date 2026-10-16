import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MunicipalitiesView } from "./municipalities-view";

export const metadata = { title: "市区町村踏破" };

// 市区町村踏破：市区町村ごとの経験値（住居・宿泊・訪問・接地・通過）と、経県値
export default async function MunicipalitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string | string[] }>;
}) {
  const { pref: prefParam } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const { data: rows } = await supabase
    .from("municipality_levels")
    .select("code, level, first_visited_on, last_visited_on")
    .order("code")
    .range(0, 9999);
  return <MunicipalitiesView rows={rows ?? []} prefParam={prefParam} />;
}
