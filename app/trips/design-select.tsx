"use client";

import { useState, useTransition } from "react";
import { PASS_DESIGNS, type PassDesign } from "@/lib/outings/boarding-pass";
import { setFlightDesign } from "./actions";

// 搭乗券のデザインを選ぶ。選んだものは保存され、取り込み直しても残る
export function DesignSelect({
  flightId,
  design,
}: {
  flightId: string;
  design: PassDesign;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      デザイン
      <select
        value={design}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await setFlightDesign({
              id: flightId,
              design: e.target.value,
            });
            setFailed(!res.ok);
          })
        }
        className="h-7 rounded-sm border border-input bg-background px-1.5 text-xs text-foreground"
      >
        {PASS_DESIGNS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      {failed && <span className="text-destructive">変えられませんでした</span>}
    </label>
  );
}
