import Link from "next/link";
import { LabelSelect } from "@/app/outings/label-select";
import { regionName } from "@/lib/geo/names";
import { labelName } from "@/lib/outings/labels";
import {
  destinationOf,
  isTicketKindKey,
  isTripDesign,
  ticketKind,
} from "@/lib/outings/ticket";
import { readTicketStyle } from "@/lib/outings/ticket-style";
import { BoardingPass, type FlightRow } from "./boarding-pass";
import { RailTicket, type RideRow } from "./rail-ticket";
import { TicketEditor } from "./ticket-editor";

// 旅の索引の 1 枚。1 回の旅を、行き先の入った切符（航空券・新幹線の特急券など）の形で見せる。
// 飛行機・新幹線の記録があれば便・乗車ごとの券を並べ、無ければ旅 1 回で 1 枚の切符（trip-ticket-view.tsx）。
// どの券も「カスタマイズ」で、種類・デザイン・飾りを本人が選び直せる

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
  // 旅の切符の見た目（本人が選んだもの。null なら自動）
  ticket_kind: string | null;
  ticket_design: string | null;
  ticket_style: unknown;
  regions: { region_code: string; visited_on: string }[];
  // 飛行機の便（あれば、切符の代わりに便ごとの搭乗券を並べる）
  flights: FlightRow[];
  // 新幹線の乗車（あれば、便と一緒に時刻の順で切符を並べる）
  rides: RideRow[];
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

  const flights = [...trip.flights].sort((a, b) =>
    a.departed_at.localeCompare(b.departed_at),
  );
  // 飛行機と新幹線を、乗った順に並べる
  const legs = [
    ...flights.map((f, i) => ({
      kind: "flight" as const,
      at: f.departed_at,
      flight: f,
      index: i,
    })),
    ...trip.rides.map((r) => ({
      kind: "ride" as const,
      at: r.departed_at,
      ride: r,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // 旅の種類を選び直す（取り込んだ旅）／手入力の旅の編集
  const controls =
    trip.source === "timeline" ? (
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
    );

  return (
    <li className="flex flex-col gap-2">
      {legs.length > 0 ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-3 px-1 font-serif">
            <span className="text-lg font-semibold">
              {from} → {destination ? shortName(destination) : "近場"}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {start.y}.{start.m}.{start.d}
              {endText && ` → ${endText}`}
              {trip.nights > 0 && `・${trip.nights} 泊`}
            </span>
          </p>
          {legs.map((leg) =>
            leg.kind === "flight" ? (
              <BoardingPass
                key={leg.flight.id}
                flight={leg.flight}
                index={leg.index}
                total={flights.length}
              />
            ) : (
              <RailTicket key={leg.ride.id} ride={leg.ride} />
            ),
          )}
        </>
      ) : (
        <TicketEditor
          ticket={{
            kind: "trip",
            data: {
              id: trip.id,
              autoKind: kind.key,
              from,
              destination: destination ? shortName(destination) : "近場",
              via: via.map(shortName),
              dateText: `${start.y}.${start.m}.${start.d}${endText ? ` → ${endText}` : ""}`,
              startedAt: trip.started_at,
              endedAt: trip.ended_at,
              startText: `${start.m}/${start.d}`,
              endText: `${end.m}/${end.d}`,
              distanceKm: trip.distance_km,
              year: start.y,
              monthDay: `${start.m}.${start.d}`,
              nights: trip.nights,
              labelText: labelName(trip.label),
            },
          }}
          initialDesign={
            isTripDesign(trip.ticket_design) ? trip.ticket_design : "atlas"
          }
          initialKind={
            isTicketKindKey(trip.ticket_kind) ? trip.ticket_kind : ""
          }
          initialStyle={readTicketStyle(trip.ticket_style)}
          note={trip.memo || null}
        >
          {controls}
        </TicketEditor>
      )}

      {legs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
          {trip.memo ? <span>{trip.memo}</span> : <span />}
          {controls}
        </div>
      )}
    </li>
  );
}
