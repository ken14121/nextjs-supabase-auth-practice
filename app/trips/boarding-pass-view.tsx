import { cn } from "cn";
import type { CSSProperties } from "react";
import {
  decorativeBars,
  flightDuration,
  type PassDesign,
  passDate,
  passTime,
} from "@/lib/outings/boarding-pass";
import {
  readableOn,
  stampLines,
  type TicketStyle,
} from "@/lib/outings/ticket-style";
import { TicketMarkIcon } from "./ticket-mark";

// 搭乗券の見た目だけ（データの取得はしない）。サーバーでもブラウザ（カスタマイズの
// プレビュー）でも同じものを描けるように、表示に必要な値だけを受け取る

export type PassData = {
  id: string;
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  departedAt: string;
  arrivedAt: string;
  distanceKm: number;
  // 搭乗券のバーコードから読んだもの（読んでいなければ null）
  airlineName: string | null;
  flightText: string | null;
  seat: string | null;
  index: number;
  total: number;
};

type Theme = {
  card: string;
  // 帯の色。null なら差し色で塗る
  bandBg: string | null;
  bandText: string | null;
  bandExtra: string;
  sub: string;
  code: string;
  bars: string;
  rule: string;
  // 差し色を選んでいないときの色
  accent: string;
};

const THEMES: Record<PassDesign, Theme> = {
  classic: {
    card: "rounded-lg border border-[#dcd6cb] bg-white text-[#1d1c1a]",
    bandBg: null,
    bandText: null,
    bandExtra: "",
    sub: "text-[#7a756c]",
    code: "font-sans font-bold tracking-tight",
    bars: "#1d1c1a",
    rule: "border-[#dcd6cb]",
    accent: "#c8432c",
  },
  mono: {
    card: "rounded-2xl border-2 border-black bg-white text-black",
    bandBg: "#ffffff",
    bandText: "#000000",
    bandExtra: "border-b-2 border-black",
    sub: "text-neutral-500",
    code: "font-sans font-black tracking-tight",
    bars: "#000000",
    rule: "border-black",
    accent: "#000000",
  },
  sand: {
    card: "rounded-md border border-[#e3d3c3] bg-white text-[#8d6a4f]",
    bandBg: null,
    bandText: null,
    bandExtra: "",
    sub: "text-[#b59a85]",
    code: "font-sans font-bold tracking-wide",
    bars: "#8d6a4f",
    rule: "border-[#e3d3c3]",
    accent: "#b8906f",
  },
  noir: {
    card: "rounded-sm border border-[#2a2a2a] bg-[#faf6ec] text-[#1a1a1a]",
    bandBg: "#141414",
    bandText: null,
    bandExtra: "",
    sub: "text-[#8a8170]",
    code: "font-serif font-semibold tracking-wide",
    bars: "#1a1a1a",
    rule: "border-[#d8ceb8]",
    accent: "#b8913f",
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
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn("text-[0.6rem] tracking-[0.15em]", sub)}>
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function BoardingPassView({
  data,
  design,
  style,
}: {
  data: PassData;
  design: PassDesign;
  style: TicketStyle;
}) {
  const t = THEMES[design];
  const accent = style.accent ?? t.accent;
  // 帯：テーマの色があればそれ、無ければ差し色。文字は読みやすい色
  const bandBg = t.bandBg ?? accent;
  const bandText = t.bandText ?? (t.bandBg ? accent : readableOn(accent));
  const band: CSSProperties = { backgroundColor: bandBg, color: bandText };
  const accentText: CSSProperties = { color: accent };

  return (
    <article
      className={cn(
        "relative grid grid-cols-[1fr_auto] overflow-hidden shadow-sm",
        t.card,
      )}
      aria-label={`搭乗券 ${data.fromCity} から ${data.toCity}`}
    >
      {/* 券面 */}
      <div className="flex min-w-0 flex-col">
        <div
          className={cn(
            "flex items-center justify-between px-4 py-1.5 text-[0.65rem] tracking-[0.25em]",
            t.bandExtra,
          )}
          style={band}
        >
          <span className="truncate">
            {data.airlineName ?? "BOARDING PASS"} ・ 搭乗券
          </span>
          <TicketMarkIcon
            mark={style.mark ?? "plane"}
            className="size-3.5 shrink-0"
          />
        </div>
        <div className="flex min-w-0 gap-3 p-3 pl-2">
          <div className="py-1">
            <Bars seed={data.id} color={t.bars} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-2">
              <Field
                label="DATE"
                value={passDate(data.departedAt)}
                sub={t.sub}
              />
              <Field
                label="FLIGHT"
                value={data.flightText ?? "----"}
                sub={t.sub}
              />
              <Field label="SEAT" value={data.seat ?? "--"} sub={t.sub} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-col">
                <span className={cn("text-3xl leading-none", t.code)}>
                  {data.fromCode}
                </span>
                <span className={cn("truncate text-xs", t.sub)}>
                  {data.fromCity}
                </span>
              </div>
              <span className="shrink-0" style={accentText}>
                <TicketMarkIcon mark="plane" className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span
                  className={cn("text-3xl leading-none", t.code)}
                  style={accentText}
                >
                  {data.toCode}
                </span>
                <span className={cn("truncate text-xs", t.sub)}>
                  {data.toCity}
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
                value={passTime(data.departedAt)}
                sub={t.sub}
              />
              <Field label="ARR" value={passTime(data.arrivedAt)} sub={t.sub} />
              <Field
                label="TIME"
                value={flightDuration(data.departedAt, data.arrivedAt)}
                sub={t.sub}
              />
              <Field
                label="DIST"
                value={`${Math.round(data.distanceKm).toLocaleString()}km`}
                sub={t.sub}
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
            t.bandExtra,
          )}
          style={band}
        >
          {data.total > 1 ? `${data.index + 1} / ${data.total}` : "STUB"}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-center">
          <span className={cn("text-lg leading-none", t.code)}>
            {data.fromCode}
          </span>
          <span className={cn("text-[0.6rem]", t.sub)}>TO</span>
          <span
            className={cn("text-lg leading-none", t.code)}
            style={accentText}
          >
            {data.toCode}
          </span>
          <span className="mt-1 text-[0.65rem] font-semibold tabular-nums">
            {passDate(data.departedAt)}
          </span>
          {style.emoji && (
            <span
              className="text-xl leading-none"
              role="img"
              aria-label={`絵文字 ${style.emoji}`}
            >
              {style.emoji}
            </span>
          )}
          {style.stamp && (
            <span
              className="mt-0.5 grid size-12 shrink-0 rotate-[-12deg] place-content-center rounded-full border-2 text-center text-[0.55rem] leading-tight font-bold opacity-85"
              style={{ borderColor: accent, color: accent }}
            >
              {stampLines(style.stamp).map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同じ文字の行があり得る。並びは変わらない
                <span key={i}>{line}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
