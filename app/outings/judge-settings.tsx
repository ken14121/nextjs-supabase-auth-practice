"use client";

import { cn } from "cn";
import { useState, useTransition } from "react";
import { saveJudgeSettings } from "./actions";

// 判定の設定。今は「帰省することがあるか」だけ。
// 答えは本人だけが見られる表に保存し、友達には見えない
export function JudgeSettings({ homecoming }: { homecoming: boolean }) {
  const [value, setValue] = useState(homecoming);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const choose = (next: boolean) => {
    if (next === value) return;
    setValue(next);
    startTransition(async () => {
      const res = await saveJudgeSettings({ homecoming: next });
      if (!res.ok) setValue(!next);
      setMessage(res.message);
    });
  };

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1">
        帰省（実家や地元に帰ること）はよくありますか？
      </legend>
      <div className="flex flex-wrap gap-2">
        {(
          [
            [true, "ある"],
            [false, "ほとんどない"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={value === v}
            disabled={isPending}
            onClick={() => choose(v)}
            className={cn(
              "h-8 rounded-sm border px-3",
              value === v
                ? "border-foreground bg-muted"
                : "border-input text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        「ほとんどない」にすると、泊まりの外出を帰省ではなく旅行として判定します。答えは自分だけが見られ、友達には見えません。
      </p>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </fieldset>
  );
}
