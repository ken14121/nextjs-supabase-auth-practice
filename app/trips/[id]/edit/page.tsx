import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { TripKind } from "@/lib/trips/schema";
import { DeleteTripButton } from "../../delete-trip-button";
import { TripForm } from "../../trip-form";

function toJstDate(iso: string) {
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  // RLS があるので、他人の旅は見つからない。取り込んだ外出もここでは編集しない
  const { data: trip } = await supabase
    .from("outings")
    .select(
      "id, started_at, ended_at, label, memo, visited_regions(region_code)",
    )
    .eq("id", id)
    .eq("source", "manual")
    .maybeSingle();
  if (!trip) notFound();

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Pencil className="size-6" />
              旅を編集
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <TripForm
              tripId={trip.id}
              defaultValues={{
                startDate: toJstDate(trip.started_at),
                endDate: toJstDate(trip.ended_at),
                kind: (trip.label ?? "trip") as TripKind,
                regions: [
                  ...new Set(trip.visited_regions.map((r) => r.region_code)),
                ],
                memo: trip.memo,
              }}
            />
            <DeleteTripButton tripId={trip.id} />
          </CardContent>
        </Card>
        <Link
          href="/trips"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          旅の一覧に戻る
        </Link>
      </div>
    </main>
  );
}
