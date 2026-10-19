import { isPrefectureCode, regionName } from "@/lib/geo/names";
import type { VisitedRegion } from "@/lib/geo/visited-colors";

// 自分と友達の「行った県・国」を比べる

// 比べた結果の 3 つのグループ。色は分類用の 3 色（色覚の違いがあっても見分けやすい組み合わせを確認済み）
export const COMPARE_GROUPS = [
  { key: "mine", label: "自分だけ", fill: "#2a78d6" },
  { key: "theirs", label: "友達だけ", fill: "#eb6834" },
  { key: "both", label: "どちらも", fill: "#1baf7a" },
] as const;

export type CompareKey = (typeof COMPARE_GROUPS)[number]["key"];

export type Comparison = Record<CompareKey, string[]>;

// 友達の訪問地は「県・国と日付」の行で届くので、県・国ごとにまとめる
export function summarizeVisits(
  rows: { region_code: string; visited_on: string }[],
): VisitedRegion[] {
  const byCode = new Map<string, Set<string>>();
  for (const row of rows) {
    const dates = byCode.get(row.region_code) ?? new Set<string>();
    dates.add(row.visited_on);
    byCode.set(row.region_code, dates);
  }
  return [...byCode].map(([code, dates]) => {
    const sorted = [...dates].sort();
    return {
      region_code: code,
      visited_days: sorted.length,
      first_visited_on: sorted[0],
      last_visited_on: sorted[sorted.length - 1],
    };
  });
}

// 県は北から（コード順）、国は日本語の名前順に並べる
function sortCodes(codes: Iterable<string>): string[] {
  return [...codes].sort((a, b) => {
    const pa = isPrefectureCode(a);
    const pb = isPrefectureCode(b);
    if (pa !== pb) return pa ? -1 : 1;
    return pa
      ? a.localeCompare(b)
      : regionName(a).localeCompare(regionName(b), "ja");
  });
}

export function compareRegions(
  mine: Iterable<string>,
  theirs: Iterable<string>,
): Comparison {
  const a = new Set(mine);
  const b = new Set(theirs);
  return {
    mine: sortCodes([...a].filter((c) => !b.has(c))),
    theirs: sortCodes([...b].filter((c) => !a.has(c))),
    both: sortCodes([...a].filter((c) => b.has(c))),
  };
}

// 国ごとに比べるときは、都道府県をまとめて「日本（JP）」にする
export function toCountries(codes: Iterable<string>): string[] {
  return [...new Set([...codes].map((c) => (isPrefectureCode(c) ? "JP" : c)))];
}

export function groupOf(
  code: string,
  comparison: Comparison,
): CompareKey | null {
  for (const group of COMPARE_GROUPS) {
    if (comparison[group.key].includes(code)) return group.key;
  }
  return null;
}
