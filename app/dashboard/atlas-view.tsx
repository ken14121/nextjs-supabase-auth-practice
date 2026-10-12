import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { VisitedMap } from "@/components/visited-map";
import { APP_NAME_LATIN } from "@/lib/app-name";
import { isPrefectureCode, PREFECTURES, regionName } from "@/lib/geo/names";
import type { VisitedRegion } from "@/lib/geo/visited-colors";
import { labelName } from "@/lib/outings/labels";

const monthFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
});

// 日本時間の 年・月・日
function jstParts(iso: string) {
  const [y, m, d] = new Date(iso)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .split("-")
    .map(Number);
  return { y, m, d };
}

// 地図帳の索引ふうの日付：2026.9.10、2026.9.10–15、2026.8.30–9.2
function formatRange(startedAt: string, endedAt: string) {
  const s = jstParts(startedAt);
  const e = jstParts(endedAt);
  const start = `${s.y}.${s.m}.${s.d}`;
  if (s.y === e.y && s.m === e.m && s.d === e.d) return start;
  if (s.y === e.y && s.m === e.m) return `${start}–${e.d}`;
  if (s.y === e.y) return `${start}–${e.m}.${e.d}`;
  return `${start}–${e.y}.${e.m}.${e.d}`;
}

export type AtlasTrip = {
  id: string;
  started_at: string;
  ended_at: string;
  nights: number;
  label: string | null;
  visited_regions: { region_code: string }[];
};

export type AtlasViewProps = {
  name: string;
  friendCode: string | null;
  regions: VisitedRegion[];
  outingCount: number;
  tripCount: number;
  pendingCount: number;
  recent: AtlasTrip[];
};

// わたしの地図帳の見た目。データの取得は page.tsx で行い、ここは表示だけ
//（ログインしなくても見た目を確かめられるようにするため）
export function AtlasView({
  name,
  friendCode,
  regions,
  outingCount,
  tripCount,
  pendingCount,
  recent,
}: AtlasViewProps) {
  const codes = regions.map((r) => r.region_code);
  const prefectureCount = codes.filter(isPrefectureCode).length;
  const countryCount = new Set(
    codes.map((c) => (isPrefectureCode(c) ? "JP" : c)),
  ).size;
  const hasRecords = outingCount > 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pt-6 pb-12 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-xs">
          <span className="tracking-[0.25em]">{APP_NAME_LATIN}</span>
          <span className="text-muted-foreground">
            {monthFormat.format(new Date())}
          </span>
        </div>
        <h1 className="sr-only">わたしの地図帳</h1>
        <p className="font-serif leading-none">
          <span className="text-7xl font-semibold tabular-nums">
            {prefectureCount}
          </span>
          <span className="ml-2 text-lg text-muted-foreground">
            / {PREFECTURES.length} 都道府県
          </span>
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 font-serif">
          {[
            { label: "か国・地域", value: countryCount },
            { label: "回の外出", value: outingCount },
            { label: "回の旅", value: tripCount },
          ].map((fig) => (
            <li key={fig.label} className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {fig.value}
              </span>
              <span className="text-sm text-muted-foreground">{fig.label}</span>
            </li>
          ))}
        </ul>
        {pendingCount > 0 && (
          <p className="border-l-2 border-vermilion pl-3 text-sm">
            まだ種類を判定していない外出が {pendingCount} 件あります。
            <Link
              href="/outings"
              className="ml-1 underline underline-offset-4 hover:text-vermilion"
            >
              記録の整理へ
            </Link>
          </p>
        )}
      </header>

      {hasRecords ? (
        <>
          <section
            aria-labelledby="map-heading"
            className="flex flex-col gap-3"
          >
            <h2
              id="map-heading"
              className="flex items-baseline justify-between border-t-2 border-ink pt-3 font-serif text-lg font-semibold"
            >
              行った場所
              <Link
                href="/map3d"
                className="font-sans text-sm font-normal underline underline-offset-4 hover:text-vermilion"
              >
                地球儀で見る
              </Link>
            </h2>
            <VisitedMap regions={regions} />
            {codes.length > 0 && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {codes.map(regionName).join("・")}
              </p>
            )}
          </section>

          <section aria-labelledby="index-heading" className="flex flex-col">
            <h2
              id="index-heading"
              className="flex items-baseline justify-between border-t-2 border-b border-ink py-2 font-serif text-lg font-semibold"
            >
              最近の旅
              <Link
                href="/trips"
                className="font-sans text-sm font-normal underline underline-offset-4 hover:text-vermilion"
              >
                旅の索引をすべて見る
              </Link>
            </h2>
            {recent.length > 0 ? (
              <ol>
                {recent.map((trip) => {
                  const places = [
                    ...new Set(trip.visited_regions.map((r) => r.region_code)),
                  ].map(regionName);
                  return (
                    <li
                      key={trip.id}
                      className="flex items-baseline gap-3 border-b border-dotted border-muted-foreground/60 py-2.5 text-sm"
                    >
                      <span className="w-28 shrink-0 font-serif text-muted-foreground tabular-nums">
                        {formatRange(trip.started_at, trip.ended_at)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {places.join("・") || "―"}
                        {trip.nights > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {trip.nights} 泊
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 border border-vermilion px-1.5 text-xs leading-5 text-vermilion">
                        {labelName(trip.label)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                まだ旅がありません。
                <Link href="/outings" className="underline underline-offset-4">
                  記録の整理
                </Link>
                で外出の種類を判定すると、ここに並びます。
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="flex flex-col items-start gap-4 border-t-2 border-ink pt-4">
          <h2 className="font-serif text-2xl font-semibold">
            まだ記録がありません
          </h2>
          <p className="text-sm leading-relaxed">
            Google
            マップのタイムラインを取り込むと、行った都道府県・国がこの地図帳に書き込まれます。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/import">タイムラインを取り込む</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/guide">書き出し方を見る</Link>
            </Button>
          </div>
        </section>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule pt-4 text-xs text-muted-foreground">
        <span>{name}</span>
        <span>
          フレンドコード{" "}
          <span className="font-mono tracking-wider text-foreground">
            {friendCode ?? "―"}
          </span>
        </span>
        <Link href="/guide" className="underline underline-offset-4">
          書き出し方
        </Link>
        <form action={signOut} className="ml-auto">
          <button
            type="submit"
            className="underline underline-offset-4 hover:text-foreground"
          >
            ログアウト
          </button>
        </form>
      </footer>
    </main>
  );
}
