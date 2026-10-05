import { ArrowLeft, Luggage, Pencil, PlusCircle, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelSelect } from "@/app/outings/label-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { regionName } from "@/lib/geo/names";
import { labelName, TRAVEL_LABELS } from "@/lib/outings/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "旅の一覧" };

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

// 検索のときに、カタカナ・ひらがなや全角・半角の違いをある程度そろえる
function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase();
}

// 旅の一覧：Jev が旅行・帰省・日帰りと判定した外出と、手入力した旅
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

  const { data: trips } = await supabase
    .from("outings")
    .select(
      "id, started_at, ended_at, nights, source, label, label_source, label_confidence, memo, visited_regions(region_code)",
    )
    .in("label", [...TRAVEL_LABELS])
    .order("started_at", { ascending: false });

  const rows = (trips ?? []).map((trip) => {
    const codes = [...new Set(trip.visited_regions.map((r) => r.region_code))];
    return { ...trip, codes, places: codes.map(regionName) };
  });
  // 行った県・国の名前とメモから探す（例:「北海道」「韓国」「修学旅行」）
  const needle = normalize(query);
  const shown = needle
    ? rows.filter((r) =>
        normalize([...r.places, r.memo].join(" ")).includes(needle),
      )
    : rows;

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Luggage className="size-6" />
              旅の一覧
            </CardTitle>
            <CardDescription>
              Jev
              が旅行・帰省・日帰りと判定した外出と、手で追加した旅です。種類が違っていたら選び直せます（「日常」にすると一覧から外れます）。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              {/* GET のフォームなので、検索語が URL（?q=）に入り、そのまま共有・再読み込みできる */}
              <form
                action="/trips"
                className="flex min-w-0 flex-1 flex-col gap-1"
              >
                <label htmlFor="trip-search" className="text-sm font-medium">
                  旅を探す
                  <span className="ml-2 font-normal text-muted-foreground">
                    県・国の名前、メモの文字から
                  </span>
                </label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="trip-search"
                      type="search"
                      name="q"
                      defaultValue={query}
                      placeholder="例: 北海道、韓国、修学旅行"
                      className="pl-8"
                    />
                  </div>
                  <Button type="submit" variant="outline">
                    検索
                  </Button>
                </div>
              </form>
              <Button asChild>
                <Link href="/trips/new">
                  <PlusCircle />
                  旅を手で追加
                </Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              {query ? (
                <>
                  「{query}」で {shown.length} 件 / 全 {rows.length} 件
                  <Link href="/trips" className="ml-2 underline">
                    検索をやめる
                  </Link>
                </>
              ) : (
                `全 ${rows.length} 件`
              )}
            </p>

            {shown.length > 0 ? (
              <ul className="divide-y text-sm">
                {shown.map((trip) => (
                  <li
                    key={trip.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">
                        {dateFormat.format(new Date(trip.started_at))}
                        {trip.nights > 0 &&
                          ` 〜 ${dateFormat.format(new Date(trip.ended_at))}（${trip.nights} 泊）`}
                      </span>
                      <span className="text-muted-foreground">
                        {trip.places.join("・") || "―"}
                      </span>
                      {trip.memo && <span>{trip.memo}</span>}
                      {trip.source === "timeline" ? (
                        <LabelSelect
                          outingId={trip.id}
                          label={trip.label}
                          source={trip.label_source}
                          confidence={trip.label_confidence}
                        />
                      ) : (
                        <span className="w-fit rounded bg-muted px-1.5 py-0.5 text-xs">
                          {labelName(trip.label)}・手入力
                        </span>
                      )}
                    </div>
                    {trip.source === "manual" && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/trips/${trip.id}/edit`}>
                          <Pencil />
                          編集
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {query
                  ? "見つかりませんでした。別の県・国の名前で探してみてください。"
                  : "まだ旅がありません。マイページで「Jev で判定する」を押すか、旅を手で追加してください。"}
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
