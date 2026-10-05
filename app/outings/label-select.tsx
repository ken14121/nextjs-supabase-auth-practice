"use client";

import { useState, useTransition } from "react";
import { UNSURE_BELOW } from "@/lib/jev/decide";
import { OUTING_LABELS, type OutingLabel } from "@/lib/outings/labels";
import { setOutingLabel } from "./actions";

// 外出の種類。Jev の判定を、本人が選び直せる
export function LabelSelect({
  outingId,
  label,
  source,
  confidence,
}: {
  outingId: string;
  label: string | null;
  source: string | null;
  confidence: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  // Jev の確率は「本当の確率」とは限らない（較正がずれることがある）ので、数字は前に出さず、
  // 低いときに「要確認」と出すことにだけ使う。数字はカーソルを合わせると見える
  const unsure =
    source === "jev" && confidence !== null && confidence < UNSURE_BELOW;
  const note =
    label === null
      ? "未判定"
      : source === "jev"
        ? unsure
          ? "Jev の判定・要確認"
          : "Jev の判定"
        : "自分で設定";
  const detail =
    source === "jev" && confidence !== null
      ? `Jev の確率 ${Math.round(confidence * 100)}%`
      : undefined;

  return (
    <span className="flex items-center gap-2 text-xs">
      <select
        aria-label="外出の種類"
        value={label ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as OutingLabel;
          startTransition(async () => {
            const res = await setOutingLabel({ id: outingId, label: next });
            setError(!res.ok);
          });
        }}
        className="h-7 rounded-md border bg-background px-1.5 text-xs"
      >
        {label === null && (
          <option value="" disabled>
            未判定
          </option>
        )}
        {OUTING_LABELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <span
        title={detail}
        className={
          error || unsure ? "text-destructive" : "text-muted-foreground"
        }
      >
        {error ? "直せませんでした" : note}
      </span>
    </span>
  );
}
