import "server-only";
import { type Fetch, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import type { OutingLabel } from "@/lib/outings/labels";
import { decideLabel } from "./decide";
import { buildOutingState, type JevContext, type OutingForJev } from "./state";

// Jev（TypeSafe AI の判定モデル）で、外出 1 回が「旅行 / 帰省 / 日帰り / 日常」の
// どれかを判定する。API キーはサーバーだけで使う（"server-only" があるので、
// うっかりブラウザ用のコードから読み込むとビルドエラーになる）。
//
// Jev には「はい / いいえ」の質問（Noul）を 2 つだけ聞き、泊数などの数えられることは
// コードで判断する（lib/jev/decide.ts）。2 つの質問は 1 回の通信でまとめて送れて、
// Jev の中で同時に判定されるので、1 つ聞くのとほぼ同じ速さ・回数で済む。

const QUESTIONS = {
  isDaily: noul(
    "この外出は、ふだんの生活の中のいつもの外出（日常）ですか。行った場所の「これまでに行った日数」と「よく行く場所」を重視してください。",
    {
      true: "日常：通学・通勤・バイト・買い物など、よく行く場所への外出。学校や友人宅に泊まっただけの日も含む",
      false:
        "日常ではない：旅行・帰省・遊びや観光での遠出など、ふだんあまり行かない場所への外出",
    },
  ),
  isHomecoming: noul(
    "この外出は、実家・親戚の家・地元への帰省ですか。年末年始・お盆・連休に、同じ場所へくり返し泊まりで行くことが多いです。",
    {
      true: "帰省：実家・親戚の家・地元に帰った",
      false: "帰省ではない：観光・レジャーなどの旅行や、そのほかの外出",
    },
  ),
};

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
  pDaily: number;
  pHomecoming: number;
};

// SDK は返ってきた JSON の形を確かめないので、外から来たデータとしてここで確かめる
const probability = z.number().min(0).max(1);
const answersSchema = z.object({
  isDaily: z.object({ noul: probability }),
  isHomecoming: z.object({ noul: probability }),
});

export async function classifyOuting(
  client: TypeSafeClient,
  outing: OutingForJev,
  ctx: JevContext,
): Promise<JevJudgement> {
  const { answers } = await client.systemOne({
    state: buildOutingState(outing, ctx),
    questions: QUESTIONS,
  });
  const parsed = answersSchema.parse(answers);
  const pDaily = parsed.isDaily.noul;
  const pHomecoming = parsed.isHomecoming.noul;
  return {
    ...decideLabel({ nights: outing.nights, pDaily, pHomecoming }),
    pDaily,
    pHomecoming,
  };
}
