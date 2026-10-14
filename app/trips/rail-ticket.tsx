import { cn } from "cn";
import { lineNameBetween, stationName } from "@/lib/geo/shinkansen";
import {
  defaultRailDesign,
  isRailDesign,
  type RailDesign,
  railDate,
  railTime,
  rideDuration,
} from "@/lib/outings/rail-ticket";
import { DesignSelect } from "./design-select";

// 新幹線に乗った 1 回ぶんの切符（特急券・乗車券ふう）。
// タイムラインから分かること（駅・日付・時刻・距離）だけを載せ、列車名・座席は「--」

export type RideRow = {
  id: string;
  departed_at: string;
  arrived_at: string;
  from_station: string;
  to_station: string;
  distance_km: number;
  design: string | null;
};

type Theme = {
  card: string;
  // 地紋（細かい模様）
  pattern: string;
  ink: string;
  accent: string;
  sub: string;
  name: string;
  stamp: string;
};

const THEMES: Record<RailDesign, Theme> = {
  mint: {
    card: "rounded-[3px] border border-[#b9d8c4] bg-[#e9f4ec]",
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(46,125,85,0.08)_6px_7px),repeating-linear-gradient(45deg,transparent_0_6px,rgba(46,125,85,0.06)_6px_7px)]",
    ink: "text-[#1f2a24]",
    accent: "text-[#2e7d55]",
    sub: "text-[#5c7566]",
    name: "font-sans font-bold",
    stamp: "border-[#2e7d55] text-[#2e7d55]",
  },
  sky: {
    card: "rounded-[3px] border border-[#b7cfe3] bg-[#e8f1f9]",
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(47,93,138,0.08)_6px_7px),repeating-linear-gradient(45deg,transparent_0_6px,rgba(47,93,138,0.06)_6px_7px)]",
    ink: "text-[#1c2733]",
    accent: "text-[#2f5d8a]",
    sub: "text-[#5b7086]",
    name: "font-sans font-bold",
    stamp: "border-[#2f5d8a] text-[#2f5d8a]",
  },
  retro: {
    card: "rounded-[2px] border-4 border-double border-[#6b5638] bg-[#f3ead2]",
    pattern:
      "bg-[radial-gradient(rgba(107,86,56,0.10)_1px,transparent_1px)] [background-size:6px_6px]",
    ink: "text-[#3b2f22]",
    accent: "text-[#8b3a2a]",
    sub: "text-[#7a6650]",
    name: "font-serif font-semibold",
    stamp: "border-[#8b3a2a] text-[#8b3a2a]",
  },
};

export function RailTicket({ ride }: { ride: RideRow }) {
  const line = lineNameBetween(ride.from_station, ride.to_station);
  const design: RailDesign = isRailDesign(ride.design)
    ? ride.design
    : defaultRailDesign(line);
  const t = THEMES[design];
  const from = stationName(ride.from_station);
  const to = stationName(ride.to_station);

  return (
    <div className="flex flex-col gap-1.5">
      <article
        className={cn("relative overflow-hidden shadow-sm", t.card, t.ink)}
        aria-label={`新幹線の切符 ${from} から ${to}`}
      >
        <div className={cn("flex flex-col gap-2 p-4", t.pattern)}>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span className="font-bold tracking-[0.3em]">
              新幹線特急券・乗車券
            </span>
            <span className={t.sub}>{line}</span>
          </p>
          <div className="flex items-end gap-3">
            <div className="flex min-w-0 flex-col">
              <span className={cn("truncate text-3xl leading-tight", t.name)}>
                {from}
              </span>
              <span className={cn("text-xs tabular-nums", t.sub)}>
                （{railTime(ride.departed_at)}発）
              </span>
            </div>
            <span
              aria-hidden="true"
              className={cn("pb-5 text-2xl font-bold", t.accent)}
            >
              →
            </span>
            <div className="flex min-w-0 flex-col">
              <span className={cn("truncate text-3xl leading-tight", t.name)}>
                {to}
              </span>
              <span className={cn("text-xs tabular-nums", t.sub)}>
                （{railTime(ride.arrived_at)}着）
              </span>
            </div>
          </div>
          <p className="flex flex-wrap gap-x-4 text-sm tabular-nums">
            <span className="font-semibold">{railDate(ride.departed_at)}</span>
            <span className={t.sub}>
              所要 {rideDuration(ride.departed_at, ride.arrived_at)}
            </span>
            <span className={t.sub}>
              約 {Math.round(ride.distance_km).toLocaleString()} km
            </span>
          </p>
          <p
            className={cn(
              "flex flex-wrap gap-x-4 border-t border-dashed border-current/30 pt-2 text-xs",
              t.sub,
            )}
          >
            <span>列車 ----号</span>
            <span>--号車</span>
            <span>--番--席</span>
          </p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-3 bottom-3 grid size-14 rotate-[-12deg] place-items-center rounded-full border-2 text-center text-[0.6rem] leading-tight font-bold opacity-80",
            t.stamp,
          )}
        >
          乗車
          <br />
          記念
        </span>
      </article>
      <div className="flex justify-end px-1">
        <DesignSelect kind="ride" id={ride.id} design={design} />
      </div>
    </div>
  );
}
