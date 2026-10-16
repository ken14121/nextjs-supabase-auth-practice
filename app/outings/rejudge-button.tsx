"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { type RejudgeResult, rejudgeWithNewQuestions } from "./actions";

// Jev への質問を変えたあとに、聞き直すボタン（間違えて押さないよう確認を出す）
export function RejudgeButton() {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RejudgeResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
          <span>
            確かめた外出は Jev
            の答えだけを取り直し、まだ確かめていない外出は未判定に戻します。
          </span>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(await rejudgeWithNewQuestions());
                setConfirming(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            聞き直す
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            やめる
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => setConfirming(true)}
        >
          <RefreshCw />
          新しい質問で Jev に聞き直す
        </Button>
      )}
      {result && (
        <p
          className={`text-sm ${result.ok ? "text-foreground" : "text-destructive"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
