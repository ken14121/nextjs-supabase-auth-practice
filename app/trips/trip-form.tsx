"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  countryOptions,
  isPrefectureCode,
  PREFECTURE_GROUPS,
  regionName,
} from "@/lib/geo/names";
import {
  TRIP_KINDS,
  type TripInput,
  todayInJapan,
  tripSchema,
} from "@/lib/trips/schema";
import { createTrip, updateTrip } from "./actions";

const COUNTRIES = countryOptions();

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

// 手入力の旅を追加・編集するフォーム（react-hook-form + Zod）
export function TripForm({
  tripId,
  defaultValues,
}: {
  tripId?: string;
  defaultValues?: TripInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const today = todayInJapan();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TripInput>({
    resolver: zodResolver(tripSchema),
    defaultValues: defaultValues ?? {
      startDate: "",
      endDate: "",
      kind: "trip",
      regions: [],
      memo: "",
    },
  });

  const regions = watch("regions");
  const kind = watch("kind");
  const selected = new Set(regions);

  const toggleRegion = (code: string) => {
    const next = selected.has(code)
      ? regions.filter((c) => c !== code)
      : [...regions, code];
    setValue("regions", next, { shouldValidate: true, shouldDirty: true });
  };

  const countryMatches = useMemo(() => {
    const q = countryQuery.trim();
    if (!q) return [];
    return COUNTRIES.filter((c) => c.keywords.includes(q.toLowerCase())).slice(
      0,
      8,
    );
  }, [countryQuery]);

  const onSubmit = async (values: TripInput) => {
    setServerError(null);
    // 成功するとサーバー側で旅の一覧へ移動する。失敗したときだけ結果が返る
    const result = tripId
      ? await updateTrip(tripId, values)
      : await createTrip(values);
    if (result && !result.ok) setServerError(result.message);
  };

  const selectedCountries = regions.filter((c) => !isPrefectureCode(c));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">行った日</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            max={today}
            aria-label="出発した日"
            aria-invalid={!!errors.startDate}
            className="w-auto"
            {...register("startDate", {
              onChange: (e) => {
                // 日帰りのときは帰った日も同じ日にそろえる
                if (kind === "day_trip") setValue("endDate", e.target.value);
              },
            })}
          />
          <span className="text-muted-foreground">〜</span>
          <Input
            type="date"
            max={today}
            aria-label="帰った日"
            aria-invalid={!!errors.endDate}
            className="w-auto"
            {...register("endDate")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          正確な日付が分からないときは、だいたいの日付で大丈夫です。
        </p>
        <FieldError message={errors.startDate?.message} />
        <FieldError message={errors.endDate?.message} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">種類</legend>
        <div className="flex flex-wrap gap-2">
          {TRIP_KINDS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground"
            >
              <input
                type="radio"
                value={option.value}
                className="sr-only"
                {...register("kind", {
                  onChange: (e) => {
                    if (e.target.value === "day_trip") {
                      setValue("endDate", watch("startDate"));
                    }
                  },
                })}
              />
              {option.label}
            </label>
          ))}
        </div>
        <FieldError message={errors.kind?.message} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">
          行った都道府県
          <span className="ml-2 font-normal text-muted-foreground">
            （複数選べます）
          </span>
        </legend>
        {PREFECTURE_GROUPS.map((group) => (
          <div key={group.name} className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{group.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.codes.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={selected.has(code)}
                  onClick={() => toggleRegion(code)}
                  className="rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {regionName(code)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          行った国（日本以外）
        </legend>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="country-search"
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="国名で探す（例: 韓国、アメリカ）"
            className="pl-8"
            autoComplete="off"
          />
        </div>
        {countryMatches.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {countryMatches.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  aria-pressed={selected.has(c.code)}
                  onClick={() => {
                    toggleRegion(c.code);
                    setCountryQuery("");
                  }}
                  className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {countryQuery.trim() && countryMatches.length === 0 && (
          <p className="text-xs text-muted-foreground">
            見つかりませんでした。正式な国名の一部で探してください（例: 大韓民国
            →「韓国」）。
          </p>
        )}
        {selectedCountries.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {selectedCountries.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => toggleRegion(code)}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-sm text-primary-foreground"
                  aria-label={`${regionName(code)} を外す`}
                >
                  {regionName(code)}
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <FieldError message={errors.regions?.message} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="memo">
          メモ
          <span className="font-normal text-muted-foreground">（任意）</span>
        </Label>
        <Textarea
          id="memo"
          placeholder="例: 高校の修学旅行"
          aria-invalid={!!errors.memo}
          {...register("memo")}
        />
        <FieldError message={errors.memo?.message} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {tripId ? "変更を保存" : "旅を追加"}
      </Button>
    </form>
  );
}
