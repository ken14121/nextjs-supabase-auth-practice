"use client";

import { Loader2, Sparkles, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ClassifyResult, classifyPendingOutings } from "./actions";

// 未判定の外出を Jev で判定するボタン。
// 「20 件だけ」と「残りをすべて」（20 件ずつくり返す。途中で止められる）の 2 つ
export function ClassifyButton({ pending }: { pending: number }) {
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [running, setRunning] = useState<"once" | "all" | null>(null);
  const [doneInRun, setDoneInRun] = useState(0);
  const stopRequested = useRef(false);
  const remaining = result?.remaining ?? pending;

  const run = async (mode: "once" | "all") => {
    stopRequested.current = false;
    setRunning(mode);
    setDoneInRun(0);
    let total = 0;
    try {
      while (true) {
        const res = await classifyPendingOutings();
        total += res.classified;
        setDoneInRun(total);
        setResult(
          mode === "all" && res.ok
            ? { ...res, message: `${total} 件を判定しました。` }
            : res,
        );
        // 1 回だけ・失敗・残りなし・止めるボタン、のどれかで終わる
        if (
          mode === "once" ||
          !res.ok ||
          res.remaining === 0 ||
          res.classified === 0 ||
          stopRequested.current
        ) {
          break;
        }
      }
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={running !== null || remaining === 0}
          onClick={() => run("once")}
        >
          {running === "once" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          Jev で 20 件判定
        </Button>
        {running === "all" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopRequested.current = true;
            }}
          >
            <Square />
            止める
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={running !== null || remaining === 0}
            onClick={() => run("all")}
          >
            残りをすべて判定
          </Button>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          未判定 {remaining} 件
        </span>
      </div>
      {running === "all" && (
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <Loader2 className="size-4 animate-spin" />
          判定しています…（{doneInRun} 件済み。20 件ごとに区切って送っています）
        </p>
      )}
      {result && running === null && (
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
