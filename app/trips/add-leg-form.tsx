"use client";

import { cn } from "cn";
import { Plus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JA_NAMES } from "@/lib/geo/airport-names";
import { STATIONS } from "@/lib/geo/shinkansen";
import { GROUND_MODES, type GroundMode, legSchema } from "@/lib/trips/legs";
import { addLeg, removeLeg } from "./actions";

// 旅に、飛行機の便・新幹線の乗車・バスなどの移動を手で足す。
// 例：成田 → 那覇 → 関西 → 成田 のように、1 回の旅を便ごとに登録できる。
// 修学旅行で「広島 → 松山 → 高松 → 徳島 → 神戸」をバスでめぐった、のようにも足せる。
// 手で足したものは、タイムラインを取り込み直しても消えない

const AIRPORT_OPTIONS = Object.entries(JA_NAMES);
const fieldClass =
  "h-8 rounded-sm border border-input bg-background px-2 text-sm";

export function AddLegForm({
  outingId,
  defaultDate,
}: {
  outingId: string;
  defaultDate: string;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  // 飛行機・新幹線、またはバスなど（GROUND_MODES）
  const [kind, setKind] = useState<"flight" | "ride" | GroundMode>("flight");
  const [date, setDate] = useState(defaultDate);
  // 何日かかけた移動の終わりの日（バスなどだけ。null なら 1 日だけ）
  const [endDate, setEndDate] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [depTime, setDepTime] = useState("");
  const [arrTime, setArrTime] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isGround = kind !== "flight" && kind !== "ride";
  const values = isGround
    ? {
        kind: "ground",
        mode: kind,
        outingId,
        date,
        endDate: endDate ?? "",
        depTime,
        arrTime,
        from,
        to,
      }
    : { kind, outingId, date, depTime, arrTime, from, to };
  const checked = legSchema.safeParse(values);
  // 入れ始めた項目だけ、おかしいところを出す
  const error =
    !checked.success && from && to ? checked.error.issues[0]?.message : null;

  const switchKind = (next: "flight" | "ride" | GroundMode) => {
    setKind(next);
    setFrom("");
    setTo("");
  };

  const submit = () =>
    startTransition(async () => {
      const res = await addLeg(values);
      if (res.ok) {
        setOpen(false);
        setFrom("");
        setTo("");
        setDepTime("");
        setArrTime("");
        setEndDate(null);
        setMessage(null);
      } else {
        setMessage(res.message);
      }
    });

  if (!open) {
    return (
      <div className="flex justify-end px-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          便・乗車を足す
        </button>
      </div>
    );
  }

  const stationSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(fieldClass, "w-32")}
    >
      <option value="">駅を選ぶ</option>
      {STATIONS.map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  );

  const airportInput = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    placeholder: string,
  ) => (
    <Input
      aria-label={label}
      list={`${ids}-airports`}
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().trim())}
      maxLength={3}
      placeholder={placeholder}
      className="h-8 w-20 font-mono uppercase"
    />
  );

  return (
    <section
      aria-label="便・乗車を足す"
      className="flex flex-col gap-3 rounded-sm border border-rule bg-background p-4 text-sm"
    >
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">種類</legend>
        {(
          [
            ["flight", "飛行機"],
            ["ride", "新幹線"],
            ...GROUND_MODES.map((m) => [m.value, m.label] as const),
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => switchKind(value)}
            className={cn(
              "h-8 rounded-sm border px-3 text-sm",
              kind === value
                ? "border-foreground bg-muted"
                : "border-input text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">日付</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        {isGround &&
          (endDate === null ? (
            <button
              type="button"
              onClick={() => setEndDate(date)}
              className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              終わりの日（何日かかけたとき）
            </button>
          ) : (
            <>
              <span aria-hidden="true">〜</span>
              <input
                type="date"
                aria-label="終わりの日"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setEndDate(null)}
                className="text-xs text-muted-foreground underline underline-offset-4"
              >
                1 日だけにする
              </button>
            </>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {kind === "flight" ? (
          <>
            {airportInput(from, setFrom, "出発の空港", "NRT")}
            <span aria-hidden="true">→</span>
            {airportInput(to, setTo, "到着の空港", "OKA")}
            <datalist id={`${ids}-airports`}>
              {AIRPORT_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </datalist>
          </>
        ) : kind === "ride" ? (
          <>
            {stationSelect(from, setFrom, "乗った駅")}
            <span aria-hidden="true">→</span>
            {stationSelect(to, setTo, "降りた駅")}
          </>
        ) : (
          <>
            <Input
              aria-label="出発した場所"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              maxLength={30}
              placeholder="広島"
              className="h-8 w-36"
            />
            <span aria-hidden="true">→</span>
            <Input
              aria-label="着いた場所"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              maxLength={30}
              placeholder="松山"
              className="h-8 w-36"
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">時刻（分かれば）</span>
        <input
          type="time"
          aria-label="出発の時刻"
          value={depTime}
          onChange={(e) => setDepTime(e.target.value)}
          className={fieldClass}
        />
        <span aria-hidden="true">→</span>
        <input
          type="time"
          aria-label="到着の時刻"
          value={arrTime}
          onChange={(e) => setArrTime(e.target.value)}
          className={fieldClass}
        />
      </div>

      {(error || message) && (
        <p role="status" className="text-xs text-destructive">
          {message ?? error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={isPending || !checked.success}
        >
          {isPending ? "足しています…" : "足す"}
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
      </div>
    </section>
  );
}

// 手で足した便・乗車を消す
export function RemoveLegButton({
  kind,
  id,
}: {
  kind: "flight" | "ride" | "ground";
  id: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-sm px-1 py-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        消す
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      消しますか？
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await removeLeg({ kind, id });
            setFailed(!res.ok);
          })
        }
        className="font-medium text-destructive underline underline-offset-4"
      >
        消す
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted-foreground underline underline-offset-4"
      >
        やめる
      </button>
      {failed && <span className="text-destructive">消せませんでした</span>}
    </span>
  );
}
