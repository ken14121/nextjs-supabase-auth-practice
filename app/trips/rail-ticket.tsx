import { lineNameBetween, stationName } from "@/lib/geo/shinkansen";
import { defaultRailDesign, isRailDesign } from "@/lib/outings/rail-ticket";
import { readTicketStyle } from "@/lib/outings/ticket-style";
import { TicketEditor } from "./ticket-editor";

// 新幹線に乗った 1 回ぶんの切符（特急券・乗車券ふう）。
// タイムラインから分かること（駅・日付・時刻・距離）だけを載せ、列車名・座席は「--」。
// 見た目（デザイン・色・マーク・絵文字・はんこ）は本人が「カスタマイズ」で変えられる

export type RideRow = {
  id: string;
  departed_at: string;
  arrived_at: string;
  from_station: string;
  to_station: string;
  distance_km: number;
  design: string | null;
  // 本人が付けた飾り（lib/outings/ticket-style.ts）
  style: unknown;
};

export function RailTicket({ ride }: { ride: RideRow }) {
  const line = lineNameBetween(ride.from_station, ride.to_station);
  const design = isRailDesign(ride.design)
    ? ride.design
    : defaultRailDesign(line);

  return (
    <TicketEditor
      ticket={{
        kind: "ride",
        data: {
          id: ride.id,
          from: stationName(ride.from_station),
          to: stationName(ride.to_station),
          line,
          departedAt: ride.departed_at,
          arrivedAt: ride.arrived_at,
          distanceKm: ride.distance_km,
        },
      }}
      initialDesign={design}
      initialStyle={readTicketStyle(ride.style)}
    />
  );
}
