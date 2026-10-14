"use client";

import { ScanLine } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  BoardingPassFormatError,
  matchesFlight,
  parseBoardingPass,
} from "@/lib/outings/bcbp";
import { attachBoardingPass } from "./actions";

// 搭乗券の写真（紙の搭乗券・スマホの搭乗券のスクリーンショット）からバーコードを読み、
// 航空会社・便名・座席をこの便に足す。
//   ・写真とバーコードの中身は、この端末（ブラウザ）の中で読むだけで、どこにも送らない
//   ・名前と予約番号は読み飛ばす。サーバーに送るのは航空会社・便名・座席だけ
export function ScanBoardingPass({
  flight,
}: {
  flight: {
    id: string;
    from: string | null;
    to: string | null;
    departedAt: string;
  };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const read = (file: File) =>
    startTransition(async () => {
      setMessage(null);
      const url = URL.createObjectURL(file);
      try {
        // バーコードを読む部品は大きいので、使うときだけ読み込む
        const [
          { BrowserMultiFormatReader },
          { BarcodeFormat, DecodeHintType },
        ] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.PDF_417,
          BarcodeFormat.AZTEC,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        let text: string;
        try {
          const result = await new BrowserMultiFormatReader(
            hints,
          ).decodeFromImageUrl(url);
          text = result.getText();
        } catch {
          setMessage({
            ok: false,
            text: "バーコードが見つかりませんでした。バーコード全体が写るように、明るい所で撮り直してください。",
          });
          return;
        }

        const legs = parseBoardingPass(text);
        const leg = legs.find((l) =>
          matchesFlight(l, {
            from: flight.from,
            to: flight.to,
            departedAt: flight.departedAt,
          }),
        );
        if (!leg) {
          const first = legs[0];
          setMessage({
            ok: false,
            text: `この便の搭乗券ではないようです（読み取った区間: ${first.from} → ${first.to}）。`,
          });
          return;
        }
        const res = await attachBoardingPass({
          id: flight.id,
          airline: leg.airline,
          flightNumber: leg.flightNumber,
          seat: leg.seat,
        });
        setMessage(
          res.ok
            ? {
                ok: true,
                text: `${leg.airline} ${leg.flightNumber}${leg.seat ? `・座席 ${leg.seat}` : ""} を記録しました。`,
              }
            : { ok: false, text: "記録できませんでした。" },
        );
      } catch (error) {
        setMessage({
          ok: false,
          text:
            error instanceof BoardingPassFormatError
              ? error.message
              : "読み取りに失敗しました。",
        });
      } finally {
        URL.revokeObjectURL(url);
        if (inputRef.current) inputRef.current.value = "";
      }
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="搭乗券の写真を選ぶ"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) read(file);
        }}
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        title="写真はこの端末の中で読むだけで、送信しません。名前と予約番号は使いません。"
        className="flex items-center gap-1.5 rounded-sm border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
      >
        <ScanLine className="size-3.5" aria-hidden="true" />
        {isPending ? "読み取っています…" : "搭乗券を読み込む"}
      </button>
      {message && (
        <p
          role="status"
          className={
            message.ok
              ? "text-xs text-foreground"
              : "max-w-72 text-right text-xs text-destructive"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
