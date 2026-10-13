import { redirect } from "next/navigation";
import { isPrefectureCode } from "@/lib/geo/names";
import { TRAVEL_LABELS } from "@/lib/outings/labels";
import { createClient } from "@/lib/supabase/server";
import { outingFeaturesSchema } from "@/lib/timeline/features";
import { TripsView } from "./trips-view";

export const metadata = { title: "旅の索引" };

// 旅の索引：Jev が旅行・帰省・日帰りと判定した外出と、手入力した旅を、切符の形で並べる
export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 50) ?? "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const [{ data: trips }, { data: regions }] = await Promise.all([
    supabase
      .from("outings")
      .select(
        "id, started_at, ended_at, nights, distance_km, main_transport, features, source, label, label_source, label_confidence, memo, visited_regions(region_code, visited_on)",
      )
      .in("label", [...TRAVEL_LABELS])
      .order("started_at", { ascending: false }),
    supabase.rpc("get_my_regions"),
  ]);

  // 住んでいる都道府県 = 一番多くの日に行った都道府県（切符の「出発」に使う）
  const homeRegion =
    (regions ?? [])
      .filter((r) => isPrefectureCode(r.region_code))
      .sort((a, b) => b.visited_days - a.visited_days)[0]?.region_code ?? null;

  return (
    <TripsView
      query={query}
      homeRegion={homeRegion}
      trips={(trips ?? []).map((t) => {
        const features = outingFeaturesSchema.safeParse(t.features);
        return {
          ...t,
          distance_km: Number(t.distance_km),
          maxKmFromHome: features.success ? features.data.maxKmFromHome : null,
          regions: t.visited_regions,
        };
      })}
    />
  );
}
