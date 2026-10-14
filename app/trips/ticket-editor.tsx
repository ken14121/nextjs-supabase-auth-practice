"use client";

import { cn } from "cn";
import { Palette } from "lucide-react";
import { type ReactNode, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPassDesign, PASS_DESIGNS } from "@/lib/outings/boarding-pass";
import { isRailDesign, RAIL_DESIGNS } from "@/lib/outings/rail-ticket";
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

// 搭乗券・新幹線の切符を、本人が飾る。
// 「カスタマイズ」を開くと、変えている途中の見た目がその場で切符に出る。「保存」で確定する

type Ticket =
  | { kind: "flight"; data: PassData }
  | { kind: "ride"; data: RideData };

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
  note,
  children,
}: {
  ticket: Ticket;
  initialDesign: string;
  initialStyle: TicketStyle;
  // 切符の下、左に出す注意書き（「時刻は日本時間」など）
  note?: ReactNode;
  // 切符の下、右に出すほかのボタン（「搭乗券を読み込む」など）
  children?: ReactNode;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState(initialDesign);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialStyle));
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { style, errors } = checkDraft(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const designs = ticket.kind === "flight" ? PASS_DESIGNS : RAIL_DESIGNS;
  // 閉じているときは保存済みの見た目、開いているときは下書きの見た目
  const shownDesign = open ? design : initialDesign;
  const shownStyle = open ? style : initialStyle;

  const start = () => {
    setDesign(initialDesign);
    setDraft(toDraft(initialStyle));
    setFailed(false);
    setOpen(true);
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveTicketLook({
        kind: ticket.kind,
        id: ticket.data.id,
        design,
        style,
      });
      setFailed(!res.ok);
      if (res.ok) setOpen(false);
    });

  const addEmoji = (emoji: string) =>
    setDraft((d) => ({ ...d, emoji: d.emoji + emoji }));

  return (
    <div className="flex flex-col gap-1.5">
      {ticket.kind === "flight" && isPassDesign(shownDesign) ? (
        <BoardingPassView
          data={ticket.data}
          design={shownDesign}
          style={shownStyle}
        />
      ) : ticket.kind === "ride" && isRailDesign(shownDesign) ? (
        <RailTicketView
          data={ticket.data}
          design={shownDesign}
          style={shownStyle}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <span className="text-[0.7rem] text-muted-foreground">{note}</span>
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
                  ticket.kind === "flight" ? "例：初めての沖縄" : "乗車記念"
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
                保存できませんでした
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
