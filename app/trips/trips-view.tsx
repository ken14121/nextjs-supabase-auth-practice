import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME_LATIN } from "@/lib/app-name";
import { regionName } from "@/lib/geo/names";
import { type TicketTrip, TripTicket } from "./trip-ticket";

// 検索のときに、カタカナ・ひらがなや全角・半角の違いをある程度そろえる
function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase();
}

// 旅の索引の見た目。データの取得は page.tsx で行い、ここは表示だけ
export function TripsView({
  trips,
  homeRegion,
  query,
}: {
  trips: TicketTrip[];
  homeRegion: string | null;
  query: string;
}) {
  // 行った県・国の名前とメモから探す（例:「北海道」「韓国」「修学旅行」）
  const needle = normalize(query);
  const shown = needle
    ? trips.filter((t) =>
        normalize(
          [
            ...new Set(t.regions.map((r) => regionName(r.region_code))),
            t.memo,
          ].join(" "),
        ).includes(needle),
      )
    : trips;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-6 pb-12 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-xs">
          <span className="tracking-[0.25em]">{APP_NAME_LATIN}</span>
          <span className="text-muted-foreground">旅の索引</span>
        </div>
        <h1 className="font-serif text-3xl font-semibold">旅の索引</h1>
        <p className="text-sm text-muted-foreground">
          Jev が旅行・帰省・日帰りと判定した外出と、手で追加した旅を、1
          回ずつ切符にしました。切符の種類（航空券・新幹線など）は、主な移動手段と移動の距離からだいたいで決めています。種類が違っていたら選び直せます（「日常」にすると索引から外れます）。
        </p>
        <p className="text-sm text-muted-foreground">
          飛行機の搭乗券は「搭乗券を読み込む」で、紙やスマホの搭乗券のバーコードから便名と座席を足せます。写真はこの端末の中で読むだけで送信せず、名前と予約番号は使いません（予約番号は、名前と合わせると予約を変えられてしまうことがあるため）。
        </p>
      </header>

      <section className="flex flex-col gap-3 border-t-2 border-ink pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {/* GET のフォームなので、検索語が URL（?q=）に入り、そのまま共有・再読み込みできる */}
          <form action="/trips" className="flex min-w-0 flex-1 flex-col gap-1">
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
            <Link href="/trips/new">旅を手で追加</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {query ? (
            <>
              「{query}」で {shown.length} 件 / 全 {trips.length} 件
              <Link href="/trips" className="ml-2 underline">
                検索をやめる
              </Link>
            </>
          ) : (
            `全 ${trips.length} 件`
          )}
        </p>
      </section>

      {shown.length > 0 ? (
        <ol className="flex flex-col gap-6">
          {shown.map((trip) => (
            <TripTicket key={trip.id} trip={trip} homeRegion={homeRegion} />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          {query
            ? "見つかりませんでした。別の県・国の名前で探してみてください。"
            : "まだ旅がありません。記録の整理で外出の種類を判定するか、旅を手で追加してください。"}
        </p>
      )}
    </main>
  );
}
