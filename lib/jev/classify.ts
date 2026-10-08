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
// Jev には「はい / いいえ」の質問（Noul）を 3 つだけ聞き、泊数などの数えられることは
// コードで判断する（lib/jev/decide.ts）。3 つの質問は 1 回の通信でまとめて送れて、
// Jev の中で同時に判定されるので、1 つ聞くのとほぼ同じ速さ・回数で済む。

const QUESTIONS = {
  // 判断の基準は、本人が 57 件を確かめたときの答え方に合わせて言葉にした（docs/JEV.md）
  isDaily: noul(
    [
      "この外出は、ふだんの生活の中のいつもの外出（日常）ですか。次の基準で判断してください。",
      "・学校・職場・バイト先など「いつもの場所」にだけ行った日は日常。学校や友人宅に泊まっただけの日も日常。",
      "・自宅の近く（自宅から一番遠い地点が 5km 以内）だけの外出は、知らない場所でもバイトや買い物の可能性が高いので日常。",
      "・「いつもの場所以外での滞在」が合わせて 1 時間以上ある日は、学校や仕事の前後であっても日常ではない（友人と遊んだ・食事をした・出かけた）。",
      "・旅行・帰省・遠出は日常ではない。",
    ].join("\n"),
    {
      true: "日常：いつもの場所だけ、または自宅の近くだけの外出",
      false:
        "日常ではない：いつもの場所以外で 1 時間以上過ごした外出（学校帰りに遊んだ日も含む）、旅行・帰省・遠出",
    },
  ),
  isHomecoming: noul(
    "この外出は、実家・親戚の家・地元への帰省ですか。年末年始・お盆・連休に、同じ場所へくり返し泊まりで行くことが多いです。",
    {
      true: "帰省：実家・親戚の家・地元に帰った",
      false: "帰省ではない：観光・レジャーなどの旅行や、そのほかの外出",
    },
  ),
  isDayTrip: noul(
    "この外出は、遠くへの日帰り旅行（観光地や別の地方への遠出）ですか。「自宅から一番遠い地点」の距離と、住んでいる都道府県の外に出たかを重視してください。",
    {
      true: "日帰り旅行：観光地や、ふだんの生活圏から離れた場所への遠出",
      false:
        "おでかけ：生活圏の中や近くの街で、遊ぶ・買い物・食事をした（例：都心の繁華街で遊ぶ）",
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
  pDayTrip: number;
  // この 1 回で使ったトークン数（クレジットの目安）
  tokens: number;
};

// SDK は返ってきた JSON の形を確かめないので、外から来たデータとしてここで確かめる
const probability = z.number().min(0).max(1);
const answersSchema = z.object({
  isDaily: z.object({ noul: probability }),
  isHomecoming: z.object({ noul: probability }),
  isDayTrip: z.object({ noul: probability }),
});

export async function classifyOuting(
  client: TypeSafeClient,
  outing: OutingForJev,
  ctx: JevContext,
): Promise<JevJudgement> {
  const { answers, usage } = await client.systemOne({
    state: buildOutingState(outing, ctx),
    questions: QUESTIONS,
  });
  const parsed = answersSchema.parse(answers);
  const pDaily = parsed.isDaily.noul;
  const pHomecoming = parsed.isHomecoming.noul;
  const pDayTrip = parsed.isDayTrip.noul;
  return {
    ...decideLabel({ nights: outing.nights, pDaily, pHomecoming, pDayTrip }),
    pDaily,
    pHomecoming,
    pDayTrip,
    tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
  };
}
