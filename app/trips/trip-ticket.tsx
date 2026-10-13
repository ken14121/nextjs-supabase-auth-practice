import Link from "next/link";
import { LabelSelect } from "@/app/outings/label-select";
import { regionName } from "@/lib/geo/names";
import { labelName } from "@/lib/outings/labels";
import { destinationOf, ticketKind } from "@/lib/outings/ticket";

// 旅の索引の 1 枚。1 回の旅を、行き先の入った切符（航空券・新幹線の特急券など）の形で見せる。
// 左が券面（種類・出発 → 行き先・経由地・日付）、右が半券（日付・泊数・種類のはんこ）

export type TicketTrip = {
  id: string;
  started_at: string;
  ended_at: string;
  nights: number;
  distance_km: number;
  main_transport: string | null;
  maxKmFromHome: number | null;
  source: string;
  label: string | null;
  label_source: string | null;
  label_confidence: number | null;
  memo: string;
  regions: { region_code: string; visited_on: string }[];
};

// 切符の大きな文字用に短くする（千葉県 → 千葉、東京都 → 東京、大韓民国はそのまま）
function shortName(code: string): string {
  const name = regionName(code);
  if (name === "北海道") return name;
  return name.replace(/(都|府|県)$/, "");
}

function jst(iso: string) {
  const [y, m, d] = new Date(iso)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .split("-")
    .map(Number);
  return { y, m, d };
}

export function TripTicket({
  trip,
  homeRegion,
}: {
  trip: TicketTrip;
  homeRegion: string | null;
}) {
  const kind = ticketKind(trip.main_transport, trip.maxKmFromHome);
  const { destination, via } = destinationOf(trip.regions, homeRegion);
  const from = homeRegion ? shortName(homeRegion) : "自宅";
  const start = jst(trip.started_at);
  const end = jst(trip.ended_at);
  const endText =
    start.y === end.y && start.m === end.m && start.d === end.d
      ? null
      : start.y === end.y
        ? `${end.m}.${end.d}`
        : `${end.y}.${end.m}.${end.d}`;

  return (
    <li className="flex flex-col gap-2">
      <article className="relative grid grid-cols-[1fr_auto] border border-ink/80 bg-[#fbf9f4] text-ink">
        {/* 券面 */}
        <div className="flex min-w-0 flex-col gap-2 p-4">
          <p className="flex items-baseline gap-2 text-xs">
            <span className="font-medium">{kind.name}</span>
            <span className="tracking-[0.2em] text-muted-foreground">
              {kind.latin}
            </span>
          </p>
          <p className="flex min-w-0 items-baseline gap-3 font-serif">
            <span className="shrink-0 text-lg text-muted-foreground">
              {from}
            </span>
            <span aria-hidden="true" className="shrink-0 text-vermilion">
              ⟶
            </span>
            <span className="truncate text-3xl font-semibold">
              {destination ? shortName(destination) : "近場"}
            </span>
          </p>
          {via.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              経由 {via.map(shortName).join("・")}
            </p>
          )}
          <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground tabular-nums">
            <span>
              {start.y}.{start.m}.{start.d}
              {endText && ` → ${endText}`}
            </span>
            {trip.distance_km > 0 && (
              <span>{Math.round(trip.distance_km).toLocaleString()} km</span>
            )}
          </p>
        </div>

        {/* 半券。切り取り線と、上下の切れ込み */}
        <div className="relative flex w-24 flex-col items-center justify-center gap-1 border-l-2 border-dashed border-rule px-2 py-4 text-center sm:w-28">
          <span
            aria-hidden="true"
            className="absolute -top-px -left-[9px] size-4 -translate-y-1/2 rounded-full border border-ink/80 bg-background [clip-path:inset(50%_0_0_0)]"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-px -left-[9px] size-4 translate-y-1/2 rounded-full border border-ink/80 bg-background [clip-path:inset(0_0_50%_0)]"
          />
          <span className="text-[0.65rem] text-muted-foreground tabular-nums">
            {start.y}
          </span>
          <span className="font-serif text-xl leading-none font-semibold tabular-nums">
            {start.m}.{start.d}
          </span>
          {trip.nights > 0 && (
            <span className="text-xs text-muted-foreground">
              {trip.nights} 泊
            </span>
          )}
          <span className="mt-1 -rotate-6 rounded-full border-2 border-vermilion px-2 py-0.5 text-xs font-bold text-vermilion">
            {labelName(trip.label)}
          </span>
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
        {trip.memo ? <span>{trip.memo}</span> : <span />}
        {trip.source === "timeline" ? (
          <LabelSelect
            outingId={trip.id}
            label={trip.label}
            source={trip.label_source}
            confidence={trip.label_confidence}
          />
        ) : (
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            手入力
            <Link
              href={`/trips/${trip.id}/edit`}
              className="text-foreground underline underline-offset-4"
            >
              編集
            </Link>
          </span>
        )}
      </div>
    </li>
  );
}
