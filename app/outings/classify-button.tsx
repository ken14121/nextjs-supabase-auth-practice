"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { type ClassifyResult, classifyPendingOutings } from "./actions";

// 未判定の外出を Jev で判定するボタン（1 回 20 件まで）
export function ClassifyButton({ pending }: { pending: number }) {
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = result?.remaining ?? pending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isPending || remaining === 0}
          onClick={() =>
            startTransition(async () => {
              setResult(await classifyPendingOutings());
            })
          }
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isPending ? "判定しています…" : "Jev で判定する（20 件ずつ）"}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          未判定 {remaining} 件
        </span>
      </div>
      {result && (
        <p
          className={`text-sm ${result.ok ? "text-foreground" : "text-destructive"}`}
          aria-live="polite"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
