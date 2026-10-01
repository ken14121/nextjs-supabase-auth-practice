import { ArrowLeft, Luggage, Pencil, PlusCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { regionName } from "@/lib/geo/names";
import { createClient } from "@/lib/supabase/server";
import { TRIP_KINDS } from "@/lib/trips/schema";

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  TRIP_KINDS.map((k) => [k.value, k.label]),
);

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

// 手入力した旅の一覧
export default async function TripsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const { data: trips } = await supabase
    .from("outings")
    .select(
      "id, started_at, ended_at, nights, label, memo, visited_regions(region_code)",
    )
    .eq("source", "manual")
    .order("started_at", { ascending: false });

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Luggage className="size-6" />
              手入力した旅
            </CardTitle>
            <CardDescription>
              タイムラインに残っていない旅を、手で記録したものです。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-fit">
              <Link href="/trips/new">
                <PlusCircle />
                旅を追加
              </Link>
            </Button>
            {trips && trips.length > 0 ? (
              <ul className="divide-y text-sm">
                {trips.map((trip) => {
                  const codes = [
                    ...new Set(trip.visited_regions.map((r) => r.region_code)),
                  ];
                  return (
                    <li
                      key={trip.id}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {dateFormat.format(new Date(trip.started_at))}
                          {trip.nights > 0 &&
                            ` 〜 ${dateFormat.format(new Date(trip.ended_at))}（${trip.nights} 泊）`}
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">
                            {KIND_LABELS[trip.label ?? ""] ?? "旅行"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {codes.map(regionName).join("・")}
                        </span>
                        {trip.memo && <span>{trip.memo}</span>}
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/trips/${trip.id}/edit`}>
                          <Pencil />
                          編集
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだ手入力した旅はありません。
              </p>
            )}
          </CardContent>
        </Card>
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
