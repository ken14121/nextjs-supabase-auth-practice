"use client";

import { cn } from "cn";
import { Palette } from "lucide-react";
import { type ReactNode, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JA_NAMES } from "@/lib/geo/airport-names";
import { isPassDesign, PASS_DESIGNS } from "@/lib/outings/boarding-pass";
import { isRailDesign, RAIL_DESIGNS } from "@/lib/outings/rail-ticket";
import {
  isTicketKindKey,
  isTripDesign,
  kindByKey,
  TICKET_KINDS,
  TRIP_DESIGNS,
} from "@/lib/outings/ticket";
import {
  ACCENT_PRESETS,
  compactStyle,
  TICKET_MARKS,
  type TicketMark,
  type TicketStyle,
  ticketStyleSchema,
} from "@/lib/outings/ticket-style";
import { saveTicketLook } from "./actions";
import { BoardingPassView, type PassData } from "./boarding-pass-view";
import { RailTicketView, type RideData } from "./rail-ticket-view";
import { TicketMarkIcon } from "./ticket-mark";
import { type TripData, TripTicketAnyView } from "./trip-ticket-view";

// 搭乗券・新幹線の切符・旅の切符を、本人が飾る（搭乗券は空港も直せる、旅の切符は種類も選べる）。
// 「カスタマイズ」を開くと、変えている途中の見た目がその場で切符に出る。「保存」で確定する

type Ticket =
  | { kind: "flight"; data: PassData }
  | { kind: "ride"; data: RideData }
  // バス・在来線・船・車（新幹線の切符と同じ形・同じデザイン）
  | { kind: "ground"; data: RideData }
  | { kind: "trip"; data: TripData };

const DESIGNS = {
  flight: PASS_DESIGNS,
  ride: RAIL_DESIGNS,
  ground: RAIL_DESIGNS,
  trip: TRIP_DESIGNS,
} as const;

// 空港を直す欄の候補（日本語の名前がある空港）
const AIRPORT_OPTIONS = Object.entries(JA_NAMES);
const AIRPORT_CODE = /^[A-Z]{3}$/;

// 直した空港の名前（日本語の名前が無ければ、元の空港ならその名前、それ以外はコードのまま）
function airportCity(code: string, original: string, originalCity: string) {
  return JA_NAMES[code] ?? (code === original ? originalCity : code);
}

// 押すだけで入れられる絵文字（ほかの絵文字は、入力欄にキーボードから入れる）
const QUICK_EMOJI = ["✨", "🎉", "❤️", "🌸", "🗻", "🏖️", "♨️", "🍣", "🍜", "🎡"];

// 下書き。入力の途中は形が崩れていてもよいので、文字のまま持つ
type Draft = {
  accent?: string;
  mark?: TicketMark;
  emoji: string;
  stamp: string;
};

const toDraft = (style: TicketStyle): Draft => ({
  accent: style.accent,
  mark: style.mark,
  emoji: style.emoji ?? "",
  stamp: style.stamp ?? "",
});

// 下書きを確かめる。おかしい項目はプレビューから外し、理由を返す
function checkDraft(draft: Draft): {
  style: TicketStyle;
  errors: Partial<Record<keyof TicketStyle, string>>;
} {
  const candidate = compactStyle({
    accent: draft.accent,
    mark: draft.mark,
    emoji: draft.emoji.trim(),
    stamp: draft.stamp.trim(),
  });
  const parsed = ticketStyleSchema.safeParse(candidate);
  if (parsed.success) return { style: parsed.data, errors: {} };
  const errors: Partial<Record<keyof TicketStyle, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof TicketStyle;
    errors[key] ??= issue.message;
  }
  const valid = Object.fromEntries(
    Object.entries(candidate).filter(([k]) => !(k in errors)),
  );
  return { style: ticketStyleSchema.parse(valid), errors };
}

function Swatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`色 ${color}`}
      className={cn(
        "size-7 rounded-full border border-black/15 outline-offset-2",
        selected && "outline-2 outline-foreground",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export function TicketEditor({
  ticket,
  initialDesign,
  initialStyle,
  initialKind = "",
  note,
  children,
}: {
  ticket: Ticket;
  initialDesign: string;
  initialStyle: TicketStyle;
  // 旅の切符の種類（本人が選んだもの。"" なら自動）
  initialKind?: string;
  // 切符の下、左に出す注意書き（「時刻は日本時間」など）
  note?: ReactNode;
  // 切符の下、右に出すほかのボタン（「搭乗券を読み込む」など）
  children?: ReactNode;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState(initialDesign);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialStyle));
  const [tripKind, setTripKind] = useState(initialKind);
  // 搭乗券の空港（分からない空港は空欄）
  const originalAirports =
    ticket.kind === "flight"
      ? {
          from: AIRPORT_CODE.test(ticket.data.fromCode)
            ? ticket.data.fromCode
            : "",
          to: AIRPORT_CODE.test(ticket.data.toCode) ? ticket.data.toCode : "",
        }
      : { from: "", to: "" };
  const [airports, setAirports] = useState(originalAirports);
  const [failed, setFailed] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { style, errors } = checkDraft(draft);
  const airportsChanged =
    airports.from !== originalAirports.from ||
    airports.to !== originalAirports.to;
  const airportError =
    ticket.kind === "flight" &&
    airportsChanged &&
    !(AIRPORT_CODE.test(airports.from) && AIRPORT_CODE.test(airports.to))
      ? "空港はアルファベット 3 文字のコード（例：HND）で、出発と到着の両方を入れてください"
      : null;
  const hasErrors = Object.keys(errors).length > 0 || airportError !== null;
  const designs = DESIGNS[ticket.kind];
  // 閉じているときは保存済みの見た目、開いているときは下書きの見た目
  const shownDesign = open ? design : initialDesign;
  const shownStyle = open ? style : initialStyle;
  const shownKind = open ? tripKind : initialKind;

  const start = () => {
    setDesign(initialDesign);
    setDraft(toDraft(initialStyle));
    setTripKind(initialKind);
    setAirports(originalAirports);
    setFailed(null);
    setOpen(true);
  };

  const save = () =>
    startTransition(async () => {
      const base = { id: ticket.data.id, design, style };
      const res = await saveTicketLook(
        ticket.kind === "flight"
          ? {
              kind: "flight",
              ...base,
              airports: airportsChanged ? airports : undefined,
            }
          : ticket.kind === "trip"
            ? { kind: "trip", ...base, ticketKind: tripKind || null }
            : { kind: ticket.kind, ...base },
      );
      setFailed(res.ok ? null : res.message);
      if (res.ok) setOpen(false);
    });

  // 搭乗券のプレビューには、直している途中の空港を出す
  const passData =
    ticket.kind === "flight" && open && airportsChanged
      ? {
          ...ticket.data,
          fromCode: airports.from || "???",
          fromCity: airportCity(
            airports.from,
            ticket.data.fromCode,
            ticket.data.fromCity,
          ),
          toCode: airports.to || "???",
          toCity: airportCity(
            airports.to,
            ticket.data.toCode,
            ticket.data.toCity,
          ),
        }
      : ticket.data;

  const addEmoji = (emoji: string) =>
    setDraft((d) => ({ ...d, emoji: d.emoji + emoji }));

  return (
    <div className="flex flex-col gap-1.5">
      {ticket.kind === "flight" && isPassDesign(shownDesign) ? (
        <BoardingPassView
          data={passData as PassData}
          design={shownDesign}
          style={shownStyle}
        />
      ) : (ticket.kind === "ride" || ticket.kind === "ground") &&
        isRailDesign(shownDesign) ? (
        <RailTicketView
          data={ticket.data}
          design={shownDesign}
          style={shownStyle}
        />
      ) : ticket.kind === "trip" && isTripDesign(shownDesign) ? (
        <TripTicketAnyView
          data={ticket.data}
          kind={kindByKey(
            isTicketKindKey(shownKind) ? shownKind : ticket.data.autoKind,
          )}
          design={shownDesign}
          style={shownStyle}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <span className="min-w-0 text-sm">{note}</span>
        <div className="flex flex-wrap items-start justify-end gap-3">
          {children}
          <button
            type="button"
            onClick={() => (open ? setOpen(false) : start())}
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-sm border border-input px-2 py-1 text-xs hover:bg-muted"
          >
            <Palette className="size-3.5" aria-hidden="true" />
            カスタマイズ
          </button>
        </div>
      </div>

      {open && (
        <section
          aria-label="切符のカスタマイズ"
          className="flex flex-col gap-4 rounded-sm border border-rule bg-background p-4 text-sm"
        >
          <label className="flex flex-wrap items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              デザイン
            </span>
            <select
              value={design}
              onChange={(e) => setDesign(e.target.value)}
              className="h-8 rounded-sm border border-input bg-background px-2 text-sm"
            >
              {designs.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {ticket.kind === "trip" && (
            <label className="flex flex-wrap items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                種類
              </span>
              <select
                value={tripKind}
                onChange={(e) => setTripKind(e.target.value)}
                className="h-8 rounded-sm border border-input bg-background px-2 text-sm"
              >
                <option value="">
                  自動（{kindByKey(ticket.data.autoKind).name}）
                </option>
                {TICKET_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {ticket.kind === "flight" && (
            <div className="flex flex-wrap items-start gap-3">
              <span className="w-16 shrink-0 pt-2 text-xs text-muted-foreground">
                空港
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="出発の空港"
                    list={`${ids}-airports`}
                    value={airports.from}
                    onChange={(e) =>
                      setAirports((a) => ({
                        ...a,
                        from: e.target.value.toUpperCase().trim(),
                      }))
                    }
                    maxLength={3}
                    placeholder="HND"
                    aria-invalid={airportError ? true : undefined}
                    className="h-8 w-20 font-mono uppercase"
                  />
                  <span aria-hidden="true">→</span>
                  <Input
                    aria-label="到着の空港"
                    list={`${ids}-airports`}
                    value={airports.to}
                    onChange={(e) =>
                      setAirports((a) => ({
                        ...a,
                        to: e.target.value.toUpperCase().trim(),
                      }))
                    }
                    maxLength={3}
                    placeholder="CTS"
                    aria-invalid={airportError ? true : undefined}
                    className="h-8 w-20 font-mono uppercase"
                  />
                  {airportsChanged && (
                    <button
                      type="button"
                      onClick={() => setAirports(originalAirports)}
                      className="text-xs text-muted-foreground underline underline-offset-4"
                    >
                      元に戻す
                    </button>
                  )}
                  <datalist id={`${ids}-airports`}>
                    {AIRPORT_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </datalist>
                </div>
                <p
                  className={cn(
                    "text-xs",
                    airportError ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {airportError ??
                    "違っていたら直せます。直した空港は、取り込み直しても残ります"}
                </p>
              </div>
            </div>
          )}

          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="float-left w-16 shrink-0 text-xs text-muted-foreground">
              色
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  selected={draft.accent === c}
                  onClick={() => setDraft((d) => ({ ...d, accent: c }))}
                />
              ))}
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="color"
                  value={draft.accent ?? "#c8432c"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      accent: e.target.value.toLowerCase(),
                    }))
                  }
                  className="size-7 cursor-pointer rounded-sm border border-input bg-background p-0.5"
                />
                好きな色
              </label>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, accent: undefined }))}
                aria-pressed={draft.accent === undefined}
                className={cn(
                  "rounded-sm border px-2 py-1 text-xs",
                  draft.accent === undefined
                    ? "border-foreground"
                    : "border-input text-muted-foreground",
                )}
              >
                元の色
              </button>
            </div>
          </fieldset>

          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="float-left w-16 shrink-0 text-xs text-muted-foreground">
              マーク
            </legend>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, mark: undefined }))}
                aria-pressed={draft.mark === undefined}
                className={cn(
                  "h-8 rounded-sm border px-2 text-xs",
                  draft.mark === undefined
                    ? "border-foreground"
                    : "border-input text-muted-foreground",
                )}
              >
                {ticket.kind === "flight" ? "標準" : "なし"}
              </button>
              {TICKET_MARKS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  title={m.label}
                  aria-label={m.label}
                  aria-pressed={draft.mark === m.value}
                  onClick={() => setDraft((d) => ({ ...d, mark: m.value }))}
                  className={cn(
                    "grid size-8 place-items-center rounded-sm border",
                    draft.mark === m.value
                      ? "border-foreground bg-muted"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  <TicketMarkIcon mark={m.value} className="size-4" />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-start gap-3">
            <label
              htmlFor={`${ids}-emoji`}
              className="w-16 shrink-0 pt-2 text-xs text-muted-foreground"
            >
              絵文字
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  id={`${ids}-emoji`}
                  value={draft.emoji}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, emoji: e.target.value }))
                  }
                  placeholder="例：🍣🗻"
                  aria-invalid={errors.emoji ? true : undefined}
                  className="h-8 w-32"
                />
                {draft.emoji && (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, emoji: "" }))}
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    消す
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {QUICK_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => addEmoji(e)}
                    aria-label={`${e} を入れる`}
                    className="grid size-8 place-items-center rounded-sm border border-input text-base hover:bg-muted"
                  >
                    {e}
                  </button>
                ))}
              </div>
              {errors.emoji && (
                <p className="text-xs text-destructive">{errors.emoji}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <label
              htmlFor={`${ids}-stamp`}
              className="w-16 shrink-0 pt-2 text-xs text-muted-foreground"
            >
              はんこ
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Input
                id={`${ids}-stamp`}
                value={draft.stamp}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, stamp: e.target.value }))
                }
                placeholder={
                  ticket.kind === "ride"
                    ? "乗車記念"
                    : ticket.kind === "trip"
                      ? ticket.data.labelText
                      : "例：初めての沖縄"
                }
                aria-invalid={errors.stamp ? true : undefined}
                className="h-8 w-48"
              />
              <p
                className={cn(
                  "text-xs",
                  errors.stamp ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {errors.stamp ?? "8 文字まで"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={isPending || hasErrors}
            >
              {isPending ? "保存しています…" : "保存"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft(toDraft({}))}
              disabled={isPending}
            >
              飾りを外す
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              やめる
            </Button>
            {failed && (
              <span role="status" className="text-xs text-destructive">
                {failed}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
