// 取り込み直したときに、新しいファイルの外出と、DB にある外出を対応させる。
//
// Google のタイムラインは、あとから区切りが少し変わることがある（開始時刻が数分ずれる、距離が少し変わる）。
// 「開始時刻がまったく同じ」だけで比べると同じ旅が 2 件になってしまうので、
// 「時間が重なっていれば同じ外出」とみなして、DB の行（判定・メモ）を引き継ぐ。

type Period = { startedAt: string; endedAt: string };

export type ExistingOuting = Period & {
  id: string;
  // 本人が決めた判定がある（なるべくこの行を残したい）
  userLabeled: boolean;
};

function overlapMs(a: Period, b: Period): number {
  const start = Math.max(Date.parse(a.startedAt), Date.parse(b.startedAt));
  const end = Math.min(Date.parse(a.endedAt), Date.parse(b.endedAt));
  return end - start;
}

export function matchOutings(
  drafts: Period[],
  existing: ExistingOuting[],
): {
  // drafts と同じ順で、引き継ぐ DB の行の id（無ければ null = 新しく追加）
  matchedIds: (string | null)[];
  // どの新しい外出とも重ならなかった DB の行（ファイルの期間内なら消してよい）
  unmatchedIds: string[];
} {
  const used = new Set<string>();
  const matchedIds = drafts.map((draft) => {
    const candidates = existing
      .filter((e) => !used.has(e.id) && overlapMs(draft, e) > 0)
      // 本人が判定を決めた行を優先し、次に重なりが長い行
      .sort(
        (a, b) =>
          Number(b.userLabeled) - Number(a.userLabeled) ||
          overlapMs(draft, b) - overlapMs(draft, a),
      );
    const best = candidates[0];
    if (!best) return null;
    used.add(best.id);
    return best.id;
  });
  return {
    matchedIds,
    unmatchedIds: existing.filter((e) => !used.has(e.id)).map((e) => e.id),
  };
}
