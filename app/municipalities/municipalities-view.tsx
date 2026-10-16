import Link from "next/link";
import { APP_NAME_LATIN } from "@/lib/app-name";
import { municipalityCount, municipalityName } from "@/lib/geo/municipalities";
import { LEVEL_FILLS, LEVEL_NAMES } from "@/lib/geo/municipality-colors";
import { getPrefectureMunicipalityShapes } from "@/lib/geo/municipality-shapes";
import { PREFECTURES } from "@/lib/geo/names";
import { NationalMunicipalityMap } from "./national-map";

// 一覧に出す件数（それより多いときは「ほか N」）
const LIST_SIZE = 40;
const LEVELS = [5, 4, 3, 2, 1] as const;

function Swatch({ level }: { level: number }) {
  return (
    <span
      className="inline-block size-3 border border-black/10 align-[-1px]"
      style={{ backgroundColor: LEVEL_FILLS[level] }}
    />
  );
}

export type MunicipalityRow = {
  code: string;
  level: number;
  first_visited_on: string;
  last_visited_on: string;
};

// 市区町村踏破の見た目。データの取得は page.tsx で行い、ここは表示だけ
export function MunicipalitiesView({
  rows,
  prefParam,
}: {
  rows: MunicipalityRow[];
  prefParam: string | string[] | undefined;
}) {
  const list = rows;
  const levels = Object.fromEntries(list.map((r) => [r.code, r.level]));
  const total = municipalityCount();

  // 経県値：都道府県ごとに一番高い経験値（満点 5 × 47 = 235）
  const prefLevels = PREFECTURES.map((name, i) => {
    const code = String(i + 1).padStart(2, "0");
    const inPref = list.filter((r) => r.code.startsWith(code));
    return {
      code,
      name,
      level: Math.max(0, ...inPref.map((r) => r.level)),
      count: inPref.length,
    };
  });
  const keiken = prefLevels.reduce((sum, p) => sum + p.level, 0);

  const pref =
    typeof prefParam === "string" &&
    /^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(prefParam)
      ? prefParam
      : null;
  const prefShapes = pref ? getPrefectureMunicipalityShapes(pref) : null;
  const shown = pref ? list.filter((r) => r.code.startsWith(pref)) : list;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 pt-6 pb-12 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-xs">
          <span className="tracking-[0.25em]">{APP_NAME_LATIN}</span>
          <span className="text-muted-foreground">市区町村踏破</span>
        </div>
        <h1 className="sr-only">市区町村踏破</h1>
        <p className="font-serif leading-none">
          <span className="text-7xl font-semibold tabular-nums">
            {list.length}
          </span>
          <span className="ml-2 text-lg text-muted-foreground">
            / {total.toLocaleString()} 市区町村（
            {Math.round((list.length / total) * 1000) / 10}%）
          </span>
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 font-serif">
          {LEVELS.map((level) => (
            <li key={level} className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">
                {list.filter((r) => r.level === level).length}
              </span>
              <span className="text-sm text-muted-foreground">
                <Swatch level={level} /> {LEVEL_NAMES[level]}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          経県値{" "}
          <span className="font-serif text-xl font-semibold text-foreground tabular-nums">
            {keiken}
          </span>{" "}
          / 235 点（都道府県ごとの、一番高い経験値の合計）
        </p>
      </header>

      {list.length === 0 ? (
        <section className="flex flex-col items-start gap-3 border-t-2 border-ink pt-4">
          <h2 className="font-serif text-2xl font-semibold">
            まだ市区町村の記録がありません
          </h2>
          <p className="text-sm leading-relaxed">
            市区町村の経験値は、タイムラインを取り込むときに数えます。前に取り込んだ人は、もう一度取り込んでください（外出や判定はそのまま引き継がれます）。
          </p>
          <Link
            href="/import"
            className="bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            タイムラインを取り込む
          </Link>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="flex items-baseline justify-between border-t-2 border-ink pt-3 font-serif text-lg font-semibold">
              踏破地図
              <span className="font-sans text-xs font-normal text-muted-foreground">
                市区町村にカーソルを合わせると、名前と経験値が出ます
              </span>
            </h2>
            <nav
              aria-label="地図の範囲"
              className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
            >
              <Link
                href="/municipalities"
                aria-current={pref ? undefined : "page"}
                className={
                  pref
                    ? "text-muted-foreground underline-offset-4 hover:underline"
                    : "border-b-2 border-vermilion"
                }
              >
                全国
              </Link>
              {prefLevels
                .filter((p) => p.count > 0)
                .map((p) => (
                  <Link
                    key={p.code}
                    href={`/municipalities?pref=${p.code}`}
                    aria-current={pref === p.code ? "page" : undefined}
                    className={
                      pref === p.code
                        ? "border-b-2 border-vermilion"
                        : "text-muted-foreground underline-offset-4 hover:underline"
                    }
                  >
                    {p.name}
                  </Link>
                ))}
            </nav>
            {pref && prefShapes ? (
              <svg
                viewBox={`0 0 ${prefShapes.width} ${prefShapes.height}`}
                className="mx-auto h-auto w-full max-w-xl"
                role="img"
                aria-label={`${PREFECTURES[Number(pref) - 1]}の市区町村を経験値で塗った地図`}
              >
                {prefShapes.shapes.map((s) => {
                  const level = levels[s.c] ?? 0;
                  return (
                    <path
                      key={s.c + s.d.length}
                      d={s.d}
                      fill={LEVEL_FILLS[level]}
                      className="stroke-paper"
                      strokeWidth={0.6}
                    >
                      <title>{`${s.n}：${LEVEL_NAMES[level]}`}</title>
                    </path>
                  );
                })}
              </svg>
            ) : (
              <NationalMunicipalityMap levels={levels} />
            )}
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {[...LEVELS, 0].map((level) => (
                <li key={level}>
                  <Swatch level={level} /> {level} {LEVEL_NAMES[level]}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-baseline justify-between border-t-2 border-ink pt-3 font-serif text-lg font-semibold">
              経験値ごとの市区町村
              <span className="font-sans text-xs font-normal text-muted-foreground">
                {pref ? PREFECTURES[Number(pref) - 1] : "全国"}・コード順
              </span>
            </h2>
            <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {([4, 3, 2, 1] as const).map((level) => {
                const items = shown.filter((r) => r.level === level);
                return (
                  <div key={level}>
                    <h3 className="flex items-baseline justify-between border-b border-ink py-1 font-serif font-semibold">
                      <span>
                        <Swatch level={level} /> {LEVEL_NAMES[level]}
                      </span>
                      <span className="font-sans text-xs font-normal text-muted-foreground tabular-nums">
                        {items.length}
                      </span>
                    </h3>
                    <ol className="text-sm">
                      {items.slice(0, LIST_SIZE).map((r) => {
                        const { prefecture, name } = municipalityName(r.code);
                        return (
                          <li
                            key={r.code}
                            className="border-b border-dotted border-muted-foreground/60 py-1.5"
                            title={`初めて ${r.first_visited_on}・最後 ${r.last_visited_on}`}
                          >
                            {!pref && (
                              <span className="mr-2 text-xs text-muted-foreground">
                                {prefecture}
                              </span>
                            )}
                            {name}
                          </li>
                        );
                      })}
                      {items.length > LIST_SIZE && (
                        <li className="py-1.5 text-xs text-muted-foreground">
                          ほか {items.length - LIST_SIZE}
                        </li>
                      )}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="flex items-baseline justify-between border-t-2 border-ink pt-3 font-serif text-lg font-semibold">
              経県値の内訳
              <span className="font-sans text-xs font-normal text-muted-foreground">
                {keiken} / 235 点
              </span>
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink text-left text-xs text-muted-foreground">
                  <th className="py-1.5 font-medium">都道府県</th>
                  <th className="py-1.5 font-medium">点</th>
                  <th className="py-1.5 font-medium">一番高い経験値</th>
                  <th className="py-1.5 font-medium">市区町村</th>
                </tr>
              </thead>
              <tbody>
                {prefLevels.map((p) => (
                  <tr
                    key={p.code}
                    className="border-b border-dotted border-muted-foreground/60"
                  >
                    <td className="py-1.5">
                      {p.count > 0 ? (
                        <Link
                          href={`/municipalities?pref=${p.code}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {p.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{p.name}</span>
                      )}
                    </td>
                    <td className="py-1.5 font-serif font-semibold tabular-nums">
                      {p.level}
                    </td>
                    <td className="py-1.5">
                      <Swatch level={p.level} /> {LEVEL_NAMES[p.level]}
                    </td>
                    <td className="py-1.5 text-muted-foreground tabular-nums">
                      {p.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <footer className="mt-auto flex flex-col gap-1 border-t border-rule pt-4 text-xs text-muted-foreground">
        <p>
          経験値の決め方：5 住居（自宅）・4 宿泊（夜中 3 時をまたいで滞在）・3
          訪問（15 分以上）・2 接地（15 分未満）・1
          通過（電車・車などで通った。飛行機は除く）。同じ市区町村は一番高い経験値を残します。
        </p>
        <p>
          市区町村の境界：国土数値情報（行政区域データ）（国土交通省）を加工して作成（2021
          年版。スマートニュース メディア研究所
          japan-topography）。政令指定都市は区ごとに数えます。
        </p>
      </footer>
    </main>
  );
}
