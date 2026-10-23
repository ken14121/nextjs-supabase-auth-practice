// ルールだけの判定（lib/outings/rule-judge.ts）を、本人が確かめた外出で検証する。
// docs/research/jev-report.md の「足りないデータ」を埋めるためのもの。
//
//   1. scripts/export-reviewed-outings.sql を Supabase の SQL Editor で実行し、結果を CSV（または JSON）で保存する
//   2. JITI_ALIAS='{"@":"<このリポジトリの絶対パス>"}' node node_modules/jiti/lib/jiti-cli.mjs scripts/analyze-rules.ts <保存したファイル>
//
// 出すのは件数と割合だけ。--details を付けたときだけ、外れた外出の日付と答えを出す（本人が見る用。公開しない）。
// 取り出した JSON と結果は、リポジトリに入れない。
import fs from "node:fs";
import { UNSURE_BELOW } from "@/lib/jev/decide";
import { evaluateJev } from "@/lib/jev/evaluate";
import { buildJevContext, type JevContext } from "@/lib/jev/state";
import {
  labelName,
  OUTING_LABEL_VALUES,
  type OutingLabel,
} from "@/lib/outings/labels";
import { evaluateRuleJudge, isOutingLabel } from "@/lib/outings/review";
import {
  DAY_TRIP_KM,
  OUTING_MINUTES,
  OUTING_MINUTES_OF,
  type OutingMinutesOf,
  type RuleInput,
  type RuleOptions,
  ruleJudge,
} from "@/lib/outings/rule-judge";
import {
  isClearlyDaily,
  type OutingFeatures,
  outingFeaturesSchema,
} from "@/lib/timeline/features";

type ExportedOuting = {
  started_at: string;
  ended_at: string;
  nights: number;
  distance_km: number | string;
  features: unknown;
  label: string;
  jev_label: string | null;
  jev_confidence: number | null;
  region_codes: string[];
};
type Exported = {
  homecoming: boolean;
  regions: { region_code: string; visited_days: number }[];
  outings: ExportedOuting[];
};
type Row = RuleInput & {
  userLabel: OutingLabel;
  jevLabel: OutingLabel | null;
  jevConfidence: number | null;
  features: OutingFeatures | null;
};

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("使い方: yarn jiti scripts/analyze-rules.ts <取り出した JSON>");
  process.exit(1);
}
const text = fs.readFileSync(file, "utf8");
// SQL Editor の CSV は「export」の見出しの下に、"" で囲んだ JSON が 1 つだけ入る
const raw = file.endsWith(".csv")
  ? JSON.parse(
      text
        .slice(text.indexOf("\n") + 1)
        .trim()
        .replace(/^"|"$/g, "")
        .replaceAll('""', '"'),
    )
  : JSON.parse(text);
// JSON で取ったときは [{ export: {...} }] の形になる
const data: Exported = Array.isArray(raw) ? raw[0].export : (raw.export ?? raw);

const rows: Row[] = data.outings
  .filter((o) => isOutingLabel(o.label))
  .map((o) => {
    const f = outingFeaturesSchema.safeParse(o.features);
    return {
      started_at: o.started_at,
      ended_at: o.ended_at,
      nights: o.nights,
      distance_km: Number(o.distance_km),
      region_codes: o.region_codes,
      features: f.success ? f.data : null,
      userLabel: o.label as OutingLabel,
      jevLabel: isOutingLabel(o.jev_label) ? o.jev_label : null,
      jevConfidence: o.jev_confidence,
    };
  });
const ctx = buildJevContext(data.regions, { homecoming: data.homecoming });

const pct = (v: number | null) =>
  v === null ? "―" : `${Math.round(v * 100)}%`;
const accuracyOf = (list: Row[], c: JevContext, options?: RuleOptions) =>
  evaluateRuleJudge(list, c, options).accuracy ?? 0;
const table = (head: string[], body: (string | number)[][]) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
const confusionTable = (
  pairs: { predicted: OutingLabel; user: OutingLabel }[],
  name: string,
) =>
  table(
    [`${name} ＼ 本人`, ...OUTING_LABEL_VALUES.map(labelName)],
    OUTING_LABEL_VALUES.map((p) => [
      labelName(p),
      ...OUTING_LABEL_VALUES.map(
        (u) => pairs.filter((x) => x.predicted === p && x.user === u).length,
      ),
    ]),
  );

// でたらめだが毎回同じ数の並び（結果を同じにするため）
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const out: string[] = [];
const say = (s = "") => out.push(s);

// ---------------------------------------------------------------- 0. 件数
say("## 0. 件数");
say();
say(
  `本人が確かめた外出 ${rows.length} 件（Jev の答えもあるもの ${rows.filter((r) => r.jevLabel).length} 件）。帰省の設定: ${data.homecoming ? "ある" : "ほとんどない"}`,
);
say();
say(
  table(
    ["本人の答え", ...OUTING_LABEL_VALUES.map(labelName)],
    [
      [
        "件数",
        ...OUTING_LABEL_VALUES.map(
          (l) => rows.filter((r) => r.userLabel === l).length,
        ),
      ],
    ],
  ),
);

// ---------------------------------------------------------------- 1. 今の設定
const now = evaluateRuleJudge(rows, ctx);
say();
say("## 1. 今のルール（おでかけ = いつもの場所以外に 120 分以上）");
say();
say(`正解率 **${pct(now.accuracy)}**（${now.correct} / ${now.total}）`);
say();
say(
  confusionTable(
    rows.map((r) => ({
      predicted: ruleJudge(r, ctx).label,
      user: r.userLabel,
    })),
    "ルール",
  ),
);
// 外れたのは、どのルールで決まった外出か
const missReasons = new Map<string, number>();
for (const r of rows) {
  const j = ruleJudge(r, ctx);
  if (j.label !== r.userLabel)
    missReasons.set(j.reason, (missReasons.get(j.reason) ?? 0) + 1);
}
say();
say(
  table(
    ["外れた外出が決まったルール", "件数"],
    [...missReasons].sort((a, b) => b[1] - a[1]),
  ),
);

// ---------------------------------------------------------------- 2. ルールと Jev が分かれたところ
const both = rows.filter((r): r is Row & { jevLabel: OutingLabel } =>
  Boolean(r.jevLabel),
);
if (both.length > 0) {
  const jevResult = evaluateJev(
    both.map((r) => ({
      jevLabel: r.jevLabel,
      userLabel: r.userLabel,
      jevConfidence: null,
      jevPDaily: null,
    })),
  );
  const split = both
    .map((r) => ({ ...r, rule: ruleJudge(r, ctx).label }))
    .filter((r) => r.rule !== r.jevLabel);
  const ruleWins = split.filter((r) => r.rule === r.userLabel);
  const jevWins = split.filter((r) => r.jevLabel === r.userLabel);
  const neither = split.length - ruleWins.length - jevWins.length;
  say();
  say("## 2. ルールと Jev の答えが分かれた外出");
  say();
  say(
    `Jev の答えもある ${both.length} 件で、Jev（保存した答えそのもの）の正解率 ${pct(jevResult.accuracy)}、ルール ${pct(evaluateRuleJudge(both, ctx).accuracy)}。`,
  );
  say(
    `答えが同じ ${both.length - split.length} 件、分かれた **${split.length} 件**：ルールが正しい ${ruleWins.length}・Jev が正しい ${jevWins.length}・どちらも違う ${neither}`,
  );
  say();
  const kinds = [
    ...new Set(
      split.map((r) => `${labelName(r.rule)} / ${labelName(r.jevLabel)}`),
    ),
  ];
  say(
    table(
      [
        "ルール / Jev",
        "件数",
        "ルールが正しい",
        "Jev が正しい",
        "どちらも違う",
      ],
      kinds.map((k) => {
        const g = split.filter(
          (r) => `${labelName(r.rule)} / ${labelName(r.jevLabel)}` === k,
        );
        const rw = g.filter((r) => r.rule === r.userLabel).length;
        const jw = g.filter((r) => r.jevLabel === r.userLabel).length;
        return [k, g.length, rw, jw, g.length - rw - jw];
      }),
    ),
  );
}

// ---------------------------------------------------------------- 3. 交差検証
// おでかけの境目（12 通り）を「一部の外出で選び → 残りで測る」をくり返し、
// 選ぶときに見ていない外出での正解率を見積もる
const OPTIONS: Required<RuleOptions>[] = (
  ["notUsual", "rare"] as OutingMinutesOf[]
).flatMap((of) =>
  [30, 45, 60, 90, 120, 180].map((minutes) => ({
    outingMinutes: minutes,
    outingMinutesOf: of,
  })),
);
// 一番高いものを選ぶ。同じなら、いつもの場所以外ぜんぶ・短い時間を先にする（本人が選んだときと同じ考え方）
const pick = (train: Row[]) =>
  OPTIONS.reduce(
    (best, o) => {
      const a = accuracyOf(train, ctx, o);
      return a > best.accuracy ? { option: o, accuracy: a } : best;
    },
    { option: OPTIONS[0], accuracy: -1 },
  );
const allBest = pick(rows);
const loo = rows.filter((r, i) => {
  const chosen = pick(rows.filter((_, j) => j !== i)).option;
  return ruleJudge(r, ctx, chosen).label === r.userLabel;
}).length;
const FOLDS = 5;
const REPEATS = 50;
const random = seeded(20261021);
const foldScores: number[] = [];
let sameAsNow = 0;
for (let rep = 0; rep < REPEATS; rep++) {
  const order = rows
    .map((r) => ({ r, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
  let hit = 0;
  for (let f = 0; f < FOLDS; f++) {
    const test = order.filter((_, i) => i % FOLDS === f);
    const train = order.filter((_, i) => i % FOLDS !== f);
    const chosen = pick(train).option;
    if (
      chosen.outingMinutes === OUTING_MINUTES &&
      chosen.outingMinutesOf === OUTING_MINUTES_OF
    )
      sameAsNow++;
    hit += test.filter(
      (r) => ruleJudge(r, ctx, chosen).label === r.userLabel,
    ).length;
  }
  foldScores.push(hit / rows.length);
}
const mean = foldScores.reduce((s, v) => s + v, 0) / foldScores.length;
say();
say("## 3. 交差検証（境目を選ぶときに見ていない外出での正解率）");
say();
say(
  table(
    ["測り方", "正解率"],
    [
      [
        `全部で選んで全部で測る（今のやり方。選ばれた境目: ${allBest.option.outingMinutesOf === "rare" ? "ふだん行かない場所" : "いつもの場所以外ぜんぶ"} ${allBest.option.outingMinutes} 分）`,
        pct(allBest.accuracy),
      ],
      [
        "1 件ずつ外して選び、外した 1 件で測る（leave-one-out）",
        pct(loo / rows.length),
      ],
      [
        `5 つに分けて 4 つで選び 1 つで測る × ${REPEATS} 回（平均 / 最低 / 最高）`,
        `${pct(mean)} / ${pct(Math.min(...foldScores))} / ${pct(Math.max(...foldScores))}`,
      ],
    ],
  ),
);
say();
say(
  `5 分割で選ばれた境目が今の設定（いつもの場所以外ぜんぶ 120 分）と同じだった割合: ${pct(sameAsNow / (FOLDS * REPEATS))}`,
);

// ---------------------------------------------------------------- 4. 別の県に移す
// 住んでいる県・行き先の県を、全部まとめて別の県に置きかえる（JP-01 → JP-02 … と 1 つずつずらす）
const shiftCode = (code: string) => {
  const m = /^JP-(\d{2})$/.exec(code);
  if (!m) return code;
  return `JP-${String((Number(m[1]) % 47) + 1).padStart(2, "0")}`;
};
const shiftedCtx = buildJevContext(
  data.regions.map((r) => ({ ...r, region_code: shiftCode(r.region_code) })),
  { homecoming: data.homecoming },
);
const shiftedRows = rows.map((r) => ({
  ...r,
  region_codes: r.region_codes.map(shiftCode),
}));
say();
say("## 4. 住んでいる県ごと別の県に移したら");
say();
say(
  `正解率 ${pct(accuracyOf(shiftedRows, shiftedCtx))}（移す前 ${pct(now.accuracy)}）。住んでいる県: ${ctx.homeRegion} → ${shiftedCtx.homeRegion}`,
);

// ---------------------------------------------------------------- 5. 暮らし方を変えたら
// 本人の答えは変えずに、材料だけを変える（「同じ過ごし方を、別の暮らし方の人がしたら」の目安）
const mapFeatures = (fn: (f: OutingFeatures) => OutingFeatures, km = 1) =>
  rows.map((r) => ({
    ...r,
    distance_km: r.distance_km * km,
    features: r.features ? fn(r.features) : null,
  }));
const scenarios: [string, Row[]][] = [
  ["今のまま", rows],
  [
    "移動の距離が 2 倍（車で広い範囲を動く暮らし）",
    mapFeatures((f) => ({ ...f, maxKmFromHome: f.maxKmFromHome * 2 }), 2),
  ],
  [
    "移動の距離が 3 倍",
    mapFeatures((f) => ({ ...f, maxKmFromHome: f.maxKmFromHome * 3 }), 3),
  ],
  [
    "いつもの場所の半分が「ときどき」になる（引っ越して間もない）",
    mapFeatures((f) => ({
      ...f,
      frequentMinutes: f.frequentMinutes / 2,
      sometimesMinutes: f.sometimesMinutes + f.frequentMinutes / 2,
    })),
  ],
  [
    "ときどき行く場所に毎回 1 時間多くいる（寄り道が多い）",
    mapFeatures((f) => ({ ...f, sometimesMinutes: f.sometimesMinutes + 60 })),
  ],
];
say();
say("## 5. 暮らし方を変えたら（本人の答えはそのまま、材料だけ変える）");
say();
say(
  table(
    ["暮らし方", "正解率", "いちばん多い外れ（ルール → 本人）"],
    scenarios.map(([name, list]) => {
      const misses = list
        .map((r) => ({ rule: ruleJudge(r, ctx).label, user: r.userLabel }))
        .filter((x) => x.rule !== x.user);
      const counts = new Map<string, number>();
      for (const m of misses) {
        const k = `${labelName(m.rule)} → ${labelName(m.user)}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const top = [...counts].sort((a, b) => b[1] - a[1])[0];
      return [
        name,
        pct(accuracyOf(list, ctx)),
        top ? `${top[0]}（${top[1]} 件）` : "―",
      ];
    }),
  ),
);

// ---------------------------------------------------------------- 6. ルールと Jev を組み合わせたら
// 保存してある Jev の答えを使うので、Jev には聞き直さない。組み合わせ方は前から考えていたもの（このデータで選んではいない）
if (both.length > 0) {
  // おでかけと日常の境目：泊まりなし・いつもの場所だけではない・日帰りの距離より近い
  const onBorder = (r: Row) =>
    r.nights === 0 &&
    !(r.features && isClearlyDaily(0, r.features)) &&
    (r.features ? r.features.maxKmFromHome : r.distance_km / 2) < DAY_TRIP_KM;
  const sure = (r: Row) =>
    r.jevConfidence !== null && r.jevConfidence >= UNSURE_BELOW;
  const ways: [string, (r: Row & { jevLabel: OutingLabel }) => OutingLabel][] =
    [
      ["ルールだけ", (r) => ruleJudge(r, ctx).label],
      ["Jev だけ（保存した答え）", (r) => r.jevLabel],
      [
        "ふだんはルール、おでかけと日常の境目だけ Jev",
        (r) => (onBorder(r) ? r.jevLabel : ruleJudge(r, ctx).label),
      ],
      [
        "Jev が迷っていない（要確認なし）ときだけ Jev、ほかはルール",
        (r) => (sure(r) ? r.jevLabel : ruleJudge(r, ctx).label),
      ],
    ];
  say();
  say("## 6. ルールと Jev を組み合わせたら（Jev の答えもある外出）");
  say();
  say(
    table(
      ["組み合わせ方", "正解率", "Jev に聞く外出"],
      ways.map(([name, fn], i) => {
        const hit = both.filter((r) => fn(r) === r.userLabel).length;
        const asked =
          i === 0
            ? 0
            : i === 1
              ? both.length
              : i === 2
                ? both.filter(onBorder).length
                : both.length;
        return [
          name,
          `${pct(hit / both.length)}（${hit} / ${both.length}）`,
          `${asked} 件`,
        ];
      }),
    ),
  );
  say();
  const unsure = both.filter((r) => !sure(r));
  const confident = both.filter(sure);
  const acc = (list: typeof both) =>
    list.length > 0
      ? list.filter((r) => r.jevLabel === r.userLabel).length / list.length
      : null;
  say(
    `「要確認」の当たり方（Jev の答え）：要確認なし ${pct(acc(confident))}（${confident.length} 件）・要確認あり ${pct(acc(unsure))}（${unsure.length} 件）。` +
      `要確認ありの外出だけ本人が見直すと、見直すのは ${unsure.length} 件で、Jev の外れ ${both.length - both.filter((r) => r.jevLabel === r.userLabel).length} 件のうち ${unsure.filter((r) => r.jevLabel !== r.userLabel).length} 件を拾える`,
  );
}

// ---------------------------------------------------------------- 外れた外出（本人が見る用）
if (flags.includes("--details")) {
  say();
  say("## （非公開）今のルールで外れた外出");
  say();
  say(
    table(
      [
        "出発",
        "泊",
        "自宅から最大 km",
        "ときどき 分",
        "ふだん行かない 分",
        "ルール",
        "Jev",
        "本人",
      ],
      rows
        .map((r) => ({ r, rule: ruleJudge(r, ctx).label }))
        .filter((x) => x.rule !== x.r.userLabel)
        .map(({ r, rule }) => [
          r.started_at.slice(0, 10),
          r.nights,
          r.features ? Math.round(r.features.maxKmFromHome) : "―",
          r.features ? Math.round(r.features.sometimesMinutes) : "―",
          r.features ? Math.round(r.features.rareMinutes) : "―",
          labelName(rule),
          r.jevLabel ? labelName(r.jevLabel) : "―",
          labelName(r.userLabel),
        ]),
    ),
  );
}

console.log(out.join("\n"));
