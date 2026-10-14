import { airportLabel } from "@/lib/geo/airports";
import { airlineName } from "@/lib/outings/bcbp";
import { defaultDesign, isPassDesign } from "@/lib/outings/boarding-pass";
import { readTicketStyle } from "@/lib/outings/ticket-style";
import { ScanBoardingPass } from "./scan-boarding-pass";
import { TicketEditor } from "./ticket-editor";

// 飛行機の便 1 回ぶんの搭乗券。タイムラインから分かること（空港・日付・時刻・距離）だけを載せる。
// 便名・座席は記録に無いので、搭乗券のバーコードを読み込むまでは「----」。
// 見た目（デザイン・色・マーク・絵文字・はんこ）は本人が「カスタマイズ」で変えられる

export type FlightRow = {
  id: string;
  departed_at: string;
  arrived_at: string;
  from_airport: string | null;
  to_airport: string | null;
  distance_km: number;
  design: string | null;
  // 本人が付けた飾り（lib/outings/ticket-style.ts）
  style: unknown;
  // 搭乗券のバーコードから読んだもの（読んでいなければ null）
  airline: string | null;
  flight_number: string | null;
  seat: string | null;
};

export function BoardingPass({
  flight,
  index,
  total,
}: {
  flight: FlightRow;
  index: number;
  total: number;
}) {
  const from = airportLabel(flight.from_airport);
  const to = airportLabel(flight.to_airport);
  const design = isPassDesign(flight.design)
    ? flight.design
    : defaultDesign(from.country, to.country);
  const international =
    from.country !== "" &&
    to.country !== "" &&
    (from.country !== "JP" || to.country !== "JP");

  return (
    <TicketEditor
      ticket={{
        kind: "flight",
        data: {
          id: flight.id,
          fromCode: from.code,
          fromCity: from.city,
          toCode: to.code,
          toCity: to.city,
          departedAt: flight.departed_at,
          arrivedAt: flight.arrived_at,
          distanceKm: flight.distance_km,
          airlineName: airlineName(flight.airline),
          flightText:
            flight.airline && flight.flight_number
              ? `${flight.airline} ${flight.flight_number}`
              : null,
          seat: flight.seat,
          index,
          total,
        },
      }}
      initialDesign={design}
      initialStyle={readTicketStyle(flight.style)}
      note={international ? "時刻は日本時間" : null}
    >
      {!flight.flight_number && (
        <ScanBoardingPass
          flight={{
            id: flight.id,
            from: flight.from_airport,
            to: flight.to_airport,
            departedAt: flight.departed_at,
          }}
        />
      )}
    </TicketEditor>
  );
}
