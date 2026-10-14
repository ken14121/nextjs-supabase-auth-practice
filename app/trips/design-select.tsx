"use client";

import { useState, useTransition } from "react";
import { PASS_DESIGNS } from "@/lib/outings/boarding-pass";
import { RAIL_DESIGNS } from "@/lib/outings/rail-ticket";
import { setFlightDesign, setRideDesign } from "./actions";

// 搭乗券・新幹線の切符のデザインを選ぶ。選んだものは保存され、取り込み直しても残る
export function DesignSelect({
  kind,
  id,
  design,
}: {
  kind: "flight" | "ride";
  id: string;
  design: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const options = kind === "flight" ? PASS_DESIGNS : RAIL_DESIGNS;
  const save = kind === "flight" ? setFlightDesign : setRideDesign;

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      デザイン
      <select
        value={design}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await save({ id, design: e.target.value });
            setFailed(!res.ok);
          })
        }
        className="h-7 rounded-sm border border-input bg-background px-1.5 text-xs text-foreground"
      >
        {options.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      {failed && <span className="text-destructive">変えられませんでした</span>}
    </label>
  );
}
