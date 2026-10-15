import { cn } from "cn";
import type { CSSProperties } from "react";
import {
  type RailDesign,
  railDate,
  railTime,
  rideDuration,
} from "@/lib/outings/rail-ticket";
import { stampLines, type TicketStyle } from "@/lib/outings/ticket-style";
import { TicketMarkIcon } from "./ticket-mark";

// 新幹線の切符の見た目だけ（データの取得はしない）。サーバーでもブラウザ（カスタマイズの
// プレビュー）でも同じものを描けるように、表示に必要な値だけを受け取る

export type RideData = {
  id: string;
  from: string;
  to: string;
  line: string;
  departedAt: string;
  arrivedAt: string;
  distanceKm: number;
  // 乗車ではなく旅 1 回を切符の形で見せるとき、時刻の代わりに出す文字（出発日・帰った日・泊数）
  times?: { dep: string; arr: string; length: string };
};

type Theme = {
  card: string;
  // 地紋（細かい模様）
  pattern: string;
  ink: string;
  sub: string;
  name: string;
  // 差し色を選んでいないときの色（矢印・はんこ）
  accent: string;
  // 路線の色の帯（車体の帯をイメージ。無ければ帯なし）
  stripe?: string;
};

// 路線の色の切符：白っぽい地に、車体の帯のような 2 色の線
function livery(stripe: string, accent: string, tint: string): Theme {
  return {
    card: `rounded-[3px] border border-[#d5dbe2] ${tint}`,
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(60,70,80,0.05)_6px_7px)]",
    ink: "text-[#1d232b]",
    sub: "text-[#5e6773]",
    name: "font-sans font-bold",
    accent,
    stripe,
  };
}

const THEMES: Record<RailDesign, Theme> = {
  mint: {
    card: "rounded-[3px] border border-[#b9d8c4] bg-[#e9f4ec]",
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(46,125,85,0.08)_6px_7px),repeating-linear-gradient(45deg,transparent_0_6px,rgba(46,125,85,0.06)_6px_7px)]",
    ink: "text-[#1f2a24]",
    sub: "text-[#5c7566]",
    name: "font-sans font-bold",
    accent: "#2e7d55",
  },
  sky: {
    card: "rounded-[3px] border border-[#b7cfe3] bg-[#e8f1f9]",
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(47,93,138,0.08)_6px_7px),repeating-linear-gradient(45deg,transparent_0_6px,rgba(47,93,138,0.06)_6px_7px)]",
    ink: "text-[#1c2733]",
    sub: "text-[#5b7086]",
    name: "font-sans font-bold",
    accent: "#2f5d8a",
  },
  retro: {
    card: "rounded-[2px] border-4 border-double border-[#6b5638] bg-[#f3ead2]",
    pattern:
      "bg-[radial-gradient(rgba(107,86,56,0.10)_1px,transparent_1px)] [background-size:6px_6px]",
    ink: "text-[#3b2f22]",
    sub: "text-[#7a6650]",
    name: "font-serif font-semibold",
    accent: "#8b3a2a",
  },
  tokaido: livery(
    "linear-gradient(#1e50a2 0 70%, #ffffff 70% 80%, #1e50a2 80%)",
    "#1e50a2",
    "bg-[#f6f8fb]",
  ),
  tohoku: livery(
    "linear-gradient(#00a95c 0 65%, #f08fbc 65%)",
    "#00875a",
    "bg-[#f4f9f6]",
  ),
  hokkaido: livery(
    "linear-gradient(#00a95c 0 65%, #8f3f97 65%)",
    "#7a3590",
    "bg-[#f7f5fa]",
  ),
  hokuriku: livery(
    "linear-gradient(#5bb4e5 0 60%, #b26b37 60%)",
    "#9a5a2c",
    "bg-[#f4f8fb]",
  ),
  kyushu: livery(
    "linear-gradient(#a31c1c 0 70%, #c9a227 70%)",
    "#a31c1c",
    "bg-[#fbf6f2]",
  ),
  akita: livery(
    "linear-gradient(#c8102e 0 75%, #b9bec5 75%)",
    "#c8102e",
    "bg-[#fbf5f5]",
  ),
  yamagata: livery(
    "linear-gradient(#f3a600 0 60%, #6b3fa0 60%)",
    "#6b3fa0",
    "bg-[#fbf8f0]",
  ),
};

export function RailTicketView({
  data,
  design,
  style,
}: {
  data: RideData;
  design: RailDesign;
  style: TicketStyle;
}) {
  const t = THEMES[design];
  const accent = style.accent ?? t.accent;
  const accentText: CSSProperties = { color: accent };

  return (
    <article
      className={cn("relative overflow-hidden shadow-sm", t.card, t.ink)}
      aria-label={`新幹線の切符 ${data.from} から ${data.to}`}
    >
      {t.stripe && (
        <div
          aria-hidden="true"
          className="h-2.5"
          style={{ background: t.stripe }}
        />
      )}
      <div className={cn("flex flex-col gap-2 p-4", t.pattern)}>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="font-bold tracking-[0.3em]">
            新幹線特急券・乗車券
          </span>
          <span className={cn("flex items-center gap-1", t.sub)}>
            {style.mark && (
              <span className="self-center" style={accentText}>
                <TicketMarkIcon mark={style.mark} className="size-3.5" />
              </span>
            )}
            {data.line}
          </span>
        </p>
        <div className="flex items-end gap-3">
          <div className="flex min-w-0 flex-col">
            <span className={cn("truncate text-3xl leading-tight", t.name)}>
              {data.from}
            </span>
            <span className={cn("text-xs tabular-nums", t.sub)}>
              （{data.times?.dep ?? railTime(data.departedAt)}発）
            </span>
          </div>
          <span
            aria-hidden="true"
            className="pb-5 text-2xl font-bold"
            style={accentText}
          >
            →
          </span>
          <div className="flex min-w-0 flex-col">
            <span className={cn("truncate text-3xl leading-tight", t.name)}>
              {data.to}
              {style.emoji && (
                <span
                  className="ml-2 text-2xl"
                  role="img"
                  aria-label={`絵文字 ${style.emoji}`}
                >
                  {style.emoji}
                </span>
              )}
            </span>
            <span className={cn("text-xs tabular-nums", t.sub)}>
              （{data.times?.arr ?? railTime(data.arrivedAt)}着）
            </span>
          </div>
        </div>
        <p className="flex flex-wrap gap-x-4 pr-14 text-sm tabular-nums">
          <span className="font-semibold">{railDate(data.departedAt)}</span>
          <span className={t.sub}>
            {data.times
              ? data.times.length
              : `所要 ${rideDuration(data.departedAt, data.arrivedAt)}`}
          </span>
          {data.distanceKm > 0 && (
            <span className={t.sub}>
              約 {Math.round(data.distanceKm).toLocaleString()} km
            </span>
          )}
        </p>
        <p
          className={cn(
            "flex flex-wrap gap-x-4 border-t border-dashed border-current/30 pt-2 pr-14 text-xs",
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
        className="absolute right-3 bottom-3 grid size-14 rotate-[-12deg] place-items-center rounded-full border-2 text-center text-[0.6rem] leading-tight font-bold opacity-80"
        style={{ borderColor: accent, color: accent }}
      >
        {stampLines(style.stamp || "乗車記念").map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同じ文字の行があり得る。並びは変わらない
          <span key={i}>{line}</span>
        ))}
      </span>
    </article>
  );
}
