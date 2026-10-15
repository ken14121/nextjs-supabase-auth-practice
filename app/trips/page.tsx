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
        "id, started_at, ended_at, nights, distance_km, main_transport, features, source, label, label_source, label_confidence, memo, ticket_kind, ticket_design, ticket_style, visited_regions(region_code, visited_on), flights(id, departed_at, arrived_at, from_airport, to_airport, distance_km, design, style, airline, flight_number, seat, added_by_user, has_times), train_rides(id, departed_at, arrived_at, from_station, to_station, distance_km, design, style, added_by_user, has_times), ground_legs(id, mode, from_name, to_name, departed_at, arrived_at, has_times, design, style)",
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
          flights: t.flights.map((f) => ({
            ...f,
            distance_km: Number(f.distance_km),
          })),
          grounds: t.ground_legs,
          rides: t.train_rides.map((r) => ({
            ...r,
            distance_km: Number(r.distance_km),
          })),
        };
      })}
    />
  );
}
