import { cn } from "cn";
import { Plane } from "lucide-react";
import { airportLabel } from "@/lib/geo/airports";
import {
  decorativeBars,
  defaultDesign,
  flightDuration,
  isPassDesign,
  type PassDesign,
  passDate,
  passTime,
} from "@/lib/outings/boarding-pass";
import { DesignSelect } from "./design-select";

// 飛行機の便 1 回ぶんの搭乗券。タイムラインから分かること（空港・日付・時刻・距離）だけを載せる。
// 便名・座席は記録に無いので「----」（搭乗券のバーコードを読み込めるようにしたら入れる）

export type FlightRow = {
  id: string;
  departed_at: string;
  arrived_at: string;
  from_airport: string | null;
  to_airport: string | null;
  distance_km: number;
  design: string | null;
};

type Theme = {
  card: string;
  band: string;
  body: string;
  accent: string;
  sub: string;
  code: string;
  bars: string;
  rule: string;
};

// 4 つのデザイン（クラシック・モノクロ・ベージュ・黒と金）
const THEMES: Record<PassDesign, Theme> = {
  classic: {
    card: "rounded-lg border border-[#dcd6cb] bg-white text-[#1d1c1a]",
    band: "bg-[#c8432c] text-white",
    body: "",
    accent: "text-[#c8432c]",
    sub: "text-[#7a756c]",
    code: "font-sans font-bold tracking-tight",
    bars: "#1d1c1a",
    rule: "border-[#dcd6cb]",
  },
  mono: {
    card: "rounded-2xl border-2 border-black bg-white text-black",
    band: "border-b-2 border-black bg-white text-black",
    body: "",
    accent: "text-black",
    sub: "text-neutral-500",
    code: "font-sans font-black tracking-tight",
    bars: "#000000",
    rule: "border-black",
  },
  sand: {
    card: "rounded-md border border-[#e3d3c3] bg-white text-[#8d6a4f]",
    band: "bg-[#c4a084] text-white",
    body: "",
    accent: "text-[#b08463]",
    sub: "text-[#b59a85]",
    code: "font-sans font-bold tracking-wide",
    bars: "#8d6a4f",
    rule: "border-[#e3d3c3]",
  },
  noir: {
    card: "rounded-sm border border-[#2a2a2a] bg-[#faf6ec] text-[#1a1a1a]",
    band: "bg-[#141414] text-[#d4af6a]",
    body: "",
    accent: "text-[#a8843c]",
    sub: "text-[#8a8170]",
    code: "font-serif font-semibold tracking-wide",
    bars: "#1a1a1a",
    rule: "border-[#d8ceb8]",
  },
};

function Bars({ seed, color }: { seed: string; color: string }) {
  const bars = decorativeBars(seed);
  let y = 0;
  return (
    <svg
      viewBox={`0 0 18 ${bars.reduce((sum, b) => sum + b + 1, 0)}`}
      className="h-full w-[18px]"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bars.map((b, i) => {
        const rect = (
          // biome-ignore lint/suspicious/noArrayIndexKey: 飾りの線で、並びは変わらない
          <rect key={i} x={0} y={y} width={18} height={b} fill={color} />
        );
        y += b + 1;
        return rect;
      })}
    </svg>
  );
}

function Field({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn("text-[0.6rem] tracking-[0.15em]", theme.sub)}>
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

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
  const design: PassDesign = isPassDesign(flight.design)
    ? flight.design
    : defaultDesign(from.country, to.country);
  const t = THEMES[design];
  const international =
    from.country !== "" &&
    to.country !== "" &&
    (from.country !== "JP" || to.country !== "JP");

  return (
    <div className="flex flex-col gap-1.5">
      <article
        className={cn(
          "relative grid grid-cols-[1fr_auto] overflow-hidden shadow-sm",
          t.card,
        )}
        aria-label={`搭乗券 ${from.city} から ${to.city}`}
      >
        {/* 券面 */}
        <div className="flex min-w-0 flex-col">
          <div
            className={cn(
              "flex items-center justify-between px-4 py-1.5 text-[0.65rem] tracking-[0.25em]",
              t.band,
            )}
          >
            <span>BOARDING PASS ・ 搭乗券</span>
            <Plane className="size-3.5" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 gap-3 p-3 pl-2">
            <div className="py-1">
              <Bars seed={flight.id} color={t.bars} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-2">
                <Field
                  label="DATE"
                  value={passDate(flight.departed_at)}
                  theme={t}
                />
                <Field label="FLIGHT" value="----" theme={t} />
                <Field label="SEAT" value="--" theme={t} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className={cn("text-3xl leading-none", t.code)}>
                    {from.code}
                  </span>
                  <span className={cn("truncate text-xs", t.sub)}>
                    {from.city}
                  </span>
                </div>
                <Plane
                  className={cn("size-5 shrink-0", t.accent)}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-col">
                  <span
                    className={cn("text-3xl leading-none", t.code, t.accent)}
                  >
                    {to.code}
                  </span>
                  <span className={cn("truncate text-xs", t.sub)}>
                    {to.city}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "grid grid-cols-4 gap-2 border-t border-dashed pt-2",
                  t.rule,
                )}
              >
                <Field
                  label="DEP"
                  value={passTime(flight.departed_at)}
                  theme={t}
                />
                <Field
                  label="ARR"
                  value={passTime(flight.arrived_at)}
                  theme={t}
                />
                <Field
                  label="TIME"
                  value={flightDuration(flight.departed_at, flight.arrived_at)}
                  theme={t}
                />
                <Field
                  label="DIST"
                  value={`${Math.round(flight.distance_km).toLocaleString()}km`}
                  theme={t}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 半券 */}
        <div
          className={cn(
            "flex w-20 flex-col border-l-2 border-dashed sm:w-28",
            t.rule,
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center py-1.5 text-[0.65rem] tracking-[0.2em]",
              t.band,
            )}
          >
            {total > 1 ? `${index + 1} / ${total}` : "STUB"}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-center">
            <span className={cn("text-lg leading-none", t.code)}>
              {from.code}
            </span>
            <span className={cn("text-[0.6rem]", t.sub)}>TO</span>
            <span className={cn("text-lg leading-none", t.code, t.accent)}>
              {to.code}
            </span>
            <span className="mt-1 text-[0.65rem] font-semibold tabular-nums">
              {passDate(flight.departed_at)}
            </span>
          </div>
        </div>
      </article>
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[0.7rem] text-muted-foreground">
          {international ? "時刻は日本時間" : ""}
        </span>
        <DesignSelect kind="flight" id={flight.id} design={design} />
      </div>
    </div>
  );
}
