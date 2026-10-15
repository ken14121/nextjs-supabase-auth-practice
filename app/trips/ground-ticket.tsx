import { isRailDesign, type RailDesign } from "@/lib/outings/rail-ticket";
import { readTicketStyle } from "@/lib/outings/ticket-style";
import { type GroundMode, groundMode, isGroundMode } from "@/lib/trips/legs";
import { RemoveLegButton } from "./add-leg-form";
import { TicketEditor } from "./ticket-editor";

// 本人が手で足した、バス・在来線・船・車の移動 1 回ぶんの券（新幹線の切符と同じ形）。
// 出発地・到着地は本人が書いた名前

export type GroundRow = {
  id: string;
  mode: string;
  from_name: string;
  to_name: string;
  departed_at: string;
  arrived_at: string;
  has_times: boolean;
  design: string | null;
  // 本人が付けた飾り（lib/outings/ticket-style.ts）
  style: unknown;
};

// 選んでいなければ、バスは水色、在来線はミント、船は水色、車は硬券風
const DEFAULT_DESIGN: Record<GroundMode, RailDesign> = {
  bus: "sky",
  train: "mint",
  boat: "sky",
  car: "retro",
};

export function GroundTicket({ leg }: { leg: GroundRow }) {
  const mode = isGroundMode(leg.mode) ? leg.mode : "bus";
  const design = isRailDesign(leg.design) ? leg.design : DEFAULT_DESIGN[mode];

  return (
    <TicketEditor
      ticket={{
        kind: "ground",
        data: {
          id: leg.id,
          from: leg.from_name,
          to: leg.to_name,
          line: groundMode(mode).label,
          departedAt: leg.departed_at,
          arrivedAt: leg.arrived_at,
          distanceKm: 0,
          title: groundMode(mode).title,
          stamp: groundMode(mode).stamp,
          times: leg.has_times
            ? undefined
            : { dep: "--:--", arr: "--:--", length: "時刻なし" },
        },
      }}
      initialDesign={design}
      initialStyle={readTicketStyle(leg.style)}
    >
      <RemoveLegButton kind="ground" id={leg.id} />
    </TicketEditor>
  );
}
