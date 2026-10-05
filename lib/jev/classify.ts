import "server-only";
import { choice, type Fetch, TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import { OUTING_LABEL_VALUES, type OutingLabel } from "@/lib/outings/labels";
import { buildOutingState, type JevContext, type OutingForJev } from "./state";

// Jev（TypeSafe AI の判定モデル）で、外出 1 回が「旅行 / 帰省 / 日帰り / 日常」の
// どれかを判定する。API キーはサーバーだけで使う（"server-only" があるので、
// うっかりブラウザ用のコードから読み込むとビルドエラーになる）。

// Jev への質問。答えはこの 4 つのどれかになり、それぞれの確率も返ってくる
const outingKind = choice(
  "この外出（家を出てから帰るまで）は、次のどれにあたりますか。行った場所の「これまでに行った日数」と「よく行く場所」を特に重視してください。",
  {
    trip: "旅行：観光・レジャー・イベントなどで、ふだん行かない場所へ泊まりがけで出かけた",
    homecoming:
      "帰省：実家・親戚の家・地元に帰った。年末年始・お盆・連休などに、同じ場所へ泊まりで行くことが多い",
    day_trip:
      "日帰りのお出かけ：泊まらずに、ふだんあまり行かない場所へ遊びや観光に出かけた",
    daily:
      "日常：通学・通勤・バイト・買い物など、よく行く場所へのいつもの外出。学校や友人宅に泊まっただけの日も含む",
  },
);

export class JevNotConfiguredError extends Error {}

export function createJevClient(options?: { fetch?: Fetch }): TypeSafeClient {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) {
    throw new JevNotConfiguredError(
      ".env.local に JEV_API_KEY が設定されていません",
    );
  }
  return new TypeSafeClient({
    apiKey,
    // 1 回の判定を待つのは 15 秒まで。失敗したら SDK が 2 回まで自動で再試行する
    timeout: 15_000,
    fetch: options?.fetch,
  });
}

export type JevJudgement = {
  label: OutingLabel;
  confidence: number;
  probabilities: Record<OutingLabel, number>;
};

export async function classifyOuting(
  client: TypeSafeClient,
  outing: OutingForJev,
  ctx: JevContext,
): Promise<JevJudgement> {
  const { answers } = await client.systemOne({
    state: buildOutingState(outing, ctx),
    questions: { kind: outingKind },
  });
  // SDK は返ってきた JSON の形を確かめないので、外から来たデータとしてここで確かめる
  return jevAnswerSchema.parse(answers.kind);
}

const jevAnswerSchema = z
  .object({
    choice: z.enum(OUTING_LABEL_VALUES),
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.string(), z.number()),
  })
  .transform((a) => ({
    label: a.choice,
    confidence: a.confidence,
    probabilities: a.probabilities as Record<OutingLabel, number>,
  }));
