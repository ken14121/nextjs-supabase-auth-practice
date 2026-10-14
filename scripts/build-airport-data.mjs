// 空港の一覧を、アプリで使う形にまとめるスクリプト（一度だけ手で動かす）。
//
// 元データ: OurAirports（パブリックドメイン）
//   https://github.com/davidmegginson/ourairports-data の airports.csv
// 定期便がある大・中規模の空港で、IATA の 3 文字コードがあるものだけ残す。
//
// 使い方: node scripts/build-airport-data.mjs <airports.csv>
// 出力: lib/geo/data/airports.json（[IATA, 緯度, 経度, 国, 都市名] の配列）
import { readFileSync, writeFileSync } from "node:fs";

const [csvPath] = process.argv.slice(2);
if (!csvPath) {
  console.error("使い方: node scripts/build-airport-data.mjs <airports.csv>");
  process.exit(1);
}

// "a","b,c",,d のような CSV の 1 行を、列の配列にする
function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

const [header, ...lines] = readFileSync(csvPath, "utf8").split(/\r?\n/);
const col = Object.fromEntries(parseLine(header).map((name, i) => [name, i]));
const airports = [];
for (const line of lines) {
  if (!line) continue;
  const c = parseLine(line);
  const type = c[col.type];
  if (type !== "large_airport" && type !== "medium_airport") continue;
  if (c[col.scheduled_service] !== "yes") continue;
  const iata = c[col.iata_code];
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  airports.push([
    iata,
    Math.round(Number(c[col.latitude_deg]) * 1e4) / 1e4,
    Math.round(Number(c[col.longitude_deg]) * 1e4) / 1e4,
    c[col.iso_country],
    c[col.municipality],
  ]);
}
airports.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync("lib/geo/data/airports.json", JSON.stringify(airports));
console.log("airports", airports.length);
