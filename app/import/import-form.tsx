"use client";

import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { extractSegments, TimelineFormatError } from "@/lib/timeline/parse";
import { type ImportResult, importTimeline } from "./actions";

type Status =
  | { kind: "idle" }
  | { kind: "working"; step: string }
  | { kind: "done"; result: Extract<ImportResult, { ok: true }> }
  | { kind: "error"; message: string };

// Timeline.json を選ぶ → ブラウザで必要な部分だけ取り出す → Storage に置く → サーバーで取り込む
export function ImportForm({ userId }: { userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const working = status.kind === "working";

  async function handleImport() {
    if (!file) return;

    try {
      setStatus({ kind: "working", step: "ファイルを読み込んでいます…" });
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        setStatus({
          kind: "error",
          message: "JSON ファイルとして読み込めませんでした。",
        });
        return;
      }
      // 大きな移動の軌跡などはここで捨て、滞在と移動だけを送る（数分の 1 の大きさになる）
      const { segments } = extractSegments(json);
      const body = JSON.stringify({ version: 1, segments });

      setStatus({ kind: "working", step: "アップロードしています…" });
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.json`;
      const { error: uploadError } = await supabase.storage
        .from("timelines")
        .upload(path, new Blob([body], { type: "application/json" }), {
          contentType: "application/json",
        });
      if (uploadError) {
        setStatus({
          kind: "error",
          message: `アップロードに失敗しました（${uploadError.message}）`,
        });
        return;
      }

      setStatus({
        kind: "working",
        step: "外出を区切って、行った県・国を調べています…",
      });
      const result = await importTimeline(path);
      setStatus(
        result.ok
          ? { kind: "done", result }
          : { kind: "error", message: result.message },
      );
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof TimelineFormatError
            ? error.message
            : "取り込みに失敗しました。もう一度お試しください。",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor="timeline-file"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50"
      >
        <FileUp className="size-6" />
        {file ? (
          <span className="font-medium text-foreground">{file.name}</span>
        ) : (
          <span>Timeline.json を選んでください</span>
        )}
        <input
          id="timeline-file"
          type="file"
          accept=".json,application/json"
          className="sr-only"
          disabled={working}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setStatus({ kind: "idle" });
          }}
        />
      </label>

      <Button onClick={handleImport} disabled={!file || working}>
        {working ? <Loader2 className="animate-spin" /> : <FileUp />}
        取り込む
      </Button>

      {status.kind === "working" && (
        <p className="text-sm text-muted-foreground">{status.step}</p>
      )}
      {status.kind === "error" && (
        <p className="text-sm text-destructive">{status.message}</p>
      )}
      {status.kind === "done" && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" />
            取り込みが終わりました
          </p>
          <p>
            外出 {status.result.outings} 件 ／ 都道府県{" "}
            {status.result.prefectures} ／ 国 {status.result.countries}
          </p>
          <Link href="/dashboard" className="underline underline-offset-4">
            マイページで見る
          </Link>
        </div>
      )}
    </div>
  );
}
