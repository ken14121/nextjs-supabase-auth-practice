import { cn } from "cn";
import type { CSSProperties } from "react";
import {
  type CardDesign,
  type TicketKind,
  type TripDesign,
  tripLook,
} from "@/lib/outings/ticket";
import type { TicketStyle } from "@/lib/outings/ticket-style";
import { BoardingPassView, type PassData } from "./boarding-pass-view";
import { RailTicketView, type RideData } from "./rail-ticket-view";
import { TicketMarkIcon } from "./ticket-mark";

// 飛行機・新幹線の記録が無い旅（ドライブ・手入力の旅など）の切符の見た目だけ。
// サーバーでもブラウザ（カスタマイズのプレビュー）でも同じものを描けるように、表示に必要な値だけを受け取る。
// 左が券面（種類・出発 → 行き先・経由地・日付）、右が半券（日付・泊数・はんこ）

export type TripData = {
  id: string;
  // 自動で決まった種類（本人が選んでいなければこれ）
  autoKind: TicketKind["key"];
  from: string;
  destination: string;
  via: string[];
  dateText: string;
  startedAt: string;
  endedAt: string;
  // 出発日・帰った日（「3/25」）
  startText: string;
  endText: string;
  distanceKm: number;
  year: number;
  monthDay: string;
  nights: number;
  // はんこに出す旅の種類（旅行・帰省など）
  labelText: string;
};

type Theme = {
  card: string;
  pattern: string;
  sub: string;
  name: string;
  rule: string;
  // 半券の上下の切れ込みの枠の色
  notch: string;
  accent: string;
};

const THEMES: Record<CardDesign, Theme> = {
  atlas: {
    card: "border border-ink/80 bg-[#fbf9f4] text-ink",
    pattern: "",
    sub: "text-muted-foreground",
    name: "font-serif font-semibold",
    rule: "border-rule",
    notch: "border-ink/80",
    accent: "#c8432c",
  },
  mint: {
    card: "rounded-[3px] border border-[#b9d8c4] bg-[#e9f4ec] text-[#1f2a24]",
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(46,125,85,0.08)_6px_7px),repeating-linear-gradient(45deg,transparent_0_6px,rgba(46,125,85,0.06)_6px_7px)]",
    sub: "text-[#5c7566]",
    name: "font-sans font-bold",
    rule: "border-[#9cc5ab]",
    notch: "border-[#b9d8c4]",
    accent: "#2e7d55",
  },
  sky: {
    card: "rounded-[3px] border border-[#b7cfe3] bg-[#e8f1f9] text-[#1c2733]",
    pattern:
      "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(47,93,138,0.08)_6px_7px),repeating-linear-gradient(45deg,transparent_0_6px,rgba(47,93,138,0.06)_6px_7px)]",
    sub: "text-[#5b7086]",
    name: "font-sans font-bold",
    rule: "border-[#9dbbd6]",
    notch: "border-[#b7cfe3]",
    accent: "#2f5d8a",
  },
  retro: {
    card: "rounded-[2px] border-4 border-double border-[#6b5638] bg-[#f3ead2] text-[#3b2f22]",
    pattern:
      "bg-[radial-gradient(rgba(107,86,56,0.10)_1px,transparent_1px)] [background-size:6px_6px]",
    sub: "text-[#7a6650]",
    name: "font-serif font-semibold",
    rule: "border-[#b8a582]",
    notch: "border-[#6b5638]",
    accent: "#8b3a2a",
  },
  noir: {
    card: "rounded-sm border border-[#2a2a2a] bg-[#141414] text-[#f3ead2]",
    pattern: "",
    sub: "text-[#a89f8a]",
    name: "font-serif font-semibold",
    rule: "border-[#3d3a33]",
    notch: "border-[#2a2a2a]",
    accent: "#d4af6a",
  },
};

export function TripTicketView({
  data,
  kind,
  design,
  style,
}: {
  data: TripData;
  kind: TicketKind;
  design: CardDesign;
  style: TicketStyle;
}) {
  const t = THEMES[design];
  const accent = style.accent ?? t.accent;
  const accentText: CSSProperties = { color: accent };

  return (
    <article
      className={cn("relative grid grid-cols-[1fr_auto]", t.card)}
      aria-label={`${kind.name} ${data.from} から ${data.destination}`}
    >
      {/* 券面 */}
      <div className={cn("flex min-w-0 flex-col gap-2 p-4", t.pattern)}>
        <p className="flex items-center gap-2 text-xs">
          {style.mark && (
            <span style={accentText}>
              <TicketMarkIcon mark={style.mark} className="size-3.5" />
            </span>
          )}
          <span className="font-medium">{kind.name}</span>
          <span className={cn("tracking-[0.2em]", t.sub)}>{kind.latin}</span>
        </p>
        <p className={cn("flex min-w-0 items-baseline gap-3", t.name)}>
          <span className={cn("shrink-0 text-lg font-normal", t.sub)}>
            {data.from}
          </span>
          <span aria-hidden="true" className="shrink-0" style={accentText}>
            ⟶
          </span>
          <span className="truncate text-3xl">{data.destination}</span>
          {style.emoji && (
            <span
              role="img"
              aria-label={`絵文字 ${style.emoji}`}
              className="shrink-0 text-2xl"
            >
              {style.emoji}
            </span>
          )}
        </p>
        {data.via.length > 0 && (
          <p className={cn("truncate text-xs", t.sub)}>
            経由 {data.via.join("・")}
          </p>
        )}
        <p className={cn("flex flex-wrap gap-x-4 text-xs tabular-nums", t.sub)}>
          <span>{data.dateText}</span>
          {data.distanceKm > 0 && (
            <span>{Math.round(data.distanceKm).toLocaleString()} km</span>
          )}
        </p>
      </div>

      {/* 半券。切り取り線と、上下の切れ込み */}
      <div
        className={cn(
          "relative flex w-24 flex-col items-center justify-center gap-1 border-l-2 border-dashed px-2 py-4 text-center sm:w-28",
          t.rule,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-px -left-[9px] size-4 -translate-y-1/2 rounded-full border bg-background [clip-path:inset(50%_0_0_0)]",
            t.notch,
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-px -left-[9px] size-4 translate-y-1/2 rounded-full border bg-background [clip-path:inset(0_0_50%_0)]",
            t.notch,
          )}
        />
        <span className={cn("text-[0.65rem] tabular-nums", t.sub)}>
          {data.year}
        </span>
        <span className={cn("text-xl leading-none tabular-nums", t.name)}>
          {data.monthDay}
        </span>
        {data.nights > 0 && (
          <span className={cn("text-xs", t.sub)}>{data.nights} 泊</span>
        )}
        <span
          className="mt-1 max-w-full -rotate-6 truncate rounded-full border-2 px-2 py-0.5 text-xs font-bold"
          style={{ borderColor: accent, color: accent }}
        >
          {style.stamp || data.labelText}
        </span>
      </div>
    </article>
  );
}

// 泊数の文字（日帰り / 1泊2日）
const lengthText = (nights: number) =>
  nights > 0 ? `${nights}泊${nights + 1}日` : "日帰り";

// 旅 1 回を、搭乗券の形で見せるときの中身（空港の代わりに出発地と行き先、時刻の代わりに日付）
function asPass(data: TripData): PassData {
  return {
    id: data.id,
    fromCode: data.from,
    fromCity: "出発",
    toCode: data.destination,
    toCity: data.via.length > 0 ? `経由 ${data.via.join("・")}` : "行き先",
    departedAt: data.startedAt,
    arrivedAt: data.endedAt,
    distanceKm: data.distanceKm,
    airlineName: null,
    flightText: null,
    seat: null,
    index: 0,
    total: 1,
    times: {
      dep: data.startText,
      arr: data.endText,
      length: lengthText(data.nights),
    },
  };
}

// 旅 1 回を、新幹線の切符の形で見せるときの中身
function asRide(data: TripData): RideData {
  return {
    id: data.id,
    from: data.from,
    to: data.destination,
    line: data.via.length > 0 ? `経由 ${data.via.join("・")}` : "",
    departedAt: data.startedAt,
    arrivedAt: data.endedAt,
    distanceKm: data.distanceKm,
    times: {
      dep: data.startText,
      arr: data.endText,
      length: lengthText(data.nights),
    },
  };
}

// 選んだデザインに合わせて、旅の切符・搭乗券・新幹線の切符のどれかの形で描く。
// はんこは、自分で決めていなければ旅の種類（旅行・帰省など）
export function TripTicketAnyView({
  data,
  kind,
  design,
  style,
}: {
  data: TripData;
  kind: TicketKind;
  design: TripDesign;
  style: TicketStyle;
}) {
  const look = tripLook(design);
  const stamped = { ...style, stamp: style.stamp || data.labelText };
  if (look.shape === "pass") {
    return (
      <BoardingPassView
        data={asPass(data)}
        design={look.design}
        style={stamped}
      />
    );
  }
  if (look.shape === "rail") {
    return (
      <RailTicketView
        data={asRide(data)}
        design={look.design}
        style={stamped}
      />
    );
  }
  return (
    <TripTicketView
      data={data}
      kind={kind}
      design={look.design}
      style={style}
    />
  );
}
