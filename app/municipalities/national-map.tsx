"use client";

import { useEffect, useState } from "react";
import { LEVEL_FILLS, LEVEL_NAMES } from "@/lib/geo/municipality-colors";
import type { MunicipalityShapes } from "@/lib/geo/municipality-shapes";

// 全国の市区町村を経験値で塗った地図。形（約 400KB）は静的なファイルを開いたときに読み込む
export function NationalMunicipalityMap({
  levels,
}: {
  levels: Record<string, number>;
}) {
  const [data, setData] = useState<MunicipalityShapes | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/municipalities")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: MunicipalityShapes) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        地図を読み込めませんでした。ページを開き直してください。
      </p>
    );
  }
  if (!data) {
    return (
      <div className="flex aspect-[600/640] w-full items-center justify-center text-sm text-muted-foreground">
        地図を読み込んでいます…
      </div>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${data.width} ${data.height}`}
      className="h-auto w-full"
      role="img"
      aria-label="全国の市区町村を経験値で塗った地図"
    >
      {data.shapes.map((s) => {
        const level = levels[s.c] ?? 0;
        return (
          <path
            key={s.c + s.d.length}
            d={s.d}
            fill={LEVEL_FILLS[level]}
            className="stroke-paper"
            strokeWidth={0.25}
          >
            <title>{`${s.n}：${LEVEL_NAMES[level]}`}</title>
          </path>
        );
      })}
    </svg>
  );
}
