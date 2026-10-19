// 飛行機が搭乗券にならない原因を調べるためのスクリプト（自分の PC で動かすだけ。どこにも送らない）。
//
// Timeline.json の、指定した期間の滞在・移動を 1 行ずつ出す。座標は出さず、
// 近くの空港コード（60 km 以内）と距離・速さだけを出すので、結果をチャットに貼っても位置は分からない。
//
// 使い方: node scripts/inspect-flights.mjs <Timeline.json> <開始日> <終了日>
//   例:   node scripts/inspect-flights.mjs Timeline.json 2026-02-20 2026-03-08
import { readFileSync } from "node:fs";

const [file, fromDate, toDate] = process.argv.slice(2);
if (!file || !fromDate || !toDate) {
  console.error(
    "使い方: node scripts/inspect-flights.mjs <Timeline.json> <開始日 YYYY-MM-DD> <終了日 YYYY-MM-DD>",
  );
  process.exit(1);
}

const airports = JSON.parse(
  readFileSync(
    new URL("../lib/geo/data/airports.json", import.meta.url),
    "utf8",
  ),
);

function km(a, b) {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.sqrt(x * x + (b.lat - a.lat) ** 2) * 111.2;
}

function airport(p) {
  if (!p) return "-";
  let best = null;
  for (const [iata, lat, lng] of airports) {
    if (Math.abs(lat - p.lat) > 1 || Math.abs(lng - p.lng) > 1.5) continue;
    const d = km(p, { lat, lng });
    if (d <= 60 && (!best || d < best.d)) best = { iata, d };
  }
  return best ? `${best.iata}(${Math.round(best.d)}km)` : "空港なし";
}

function latLng(v) {
  const text = typeof v === "string" ? v : v?.latLng;
  const m = text?.match(/(-?\d+(?:\.\d+)?)°?,\s*(-?\d+(?:\.\d+)?)°?/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

const jst = (ms) =>
  new Date(ms).toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 16);

const json = JSON.parse(readFileSync(file, "utf8"));
const items = Array.isArray(json) ? json : (json.semanticSegments ?? []);
const start = Date.parse(`${fromDate}T00:00:00+09:00`);
const end = Date.parse(`${toDate}T23:59:59+09:00`);

const rows = [];
for (const item of items) {
  const s = Date.parse(item.startTime);
  const e = Date.parse(item.endTime);
  if (Number.isNaN(s) || e < start || s > end) continue;
  if (item.visit) {
    const p = latLng(item.visit.topCandidate?.placeLocation);
    const type = item.visit.topCandidate?.semanticType ?? "";
    rows.push({ s, e, kind: "滞在", type, from: p, to: p });
  } else if (item.activity) {
    rows.push({
      s,
      e,
      kind: "移動",
      type: item.activity.topCandidate?.type ?? "(種類なし)",
      from: latLng(item.activity.start),
      to: latLng(item.activity.end),
      meters: Number(item.activity.distanceMeters ?? 0),
    });
  } else if (item.timelinePath) {
    rows.push({ s, e, kind: "軌跡", type: `${item.timelinePath.length} 点` });
  }
}
rows.sort((a, b) => a.s - b.s);

let prev = null;
for (const r of rows) {
  if (r.kind === "軌跡") {
    console.log(`${jst(r.s)} 〜 ${jst(r.e)}  軌跡 ${r.type}`);
    continue;
  }
  // 前の記録の終わりから、この記録の始まりまでに大きく動いていたら「空白」として出す
  if (prev?.to && r.from) {
    const gapKm = km(prev.to, r.from);
    const hours = (r.s - prev.e) / 3_600_000;
    if (gapKm >= 100) {
      console.log(
        `   ↓ 記録の空白：${Math.round(gapKm)} km を ${hours.toFixed(1)} 時間（時速 ${hours > 0 ? Math.round(gapKm / hours) : "-"} km）  ${airport(prev.to)} → ${airport(r.from)}`,
      );
    }
  }
  const hours = (r.e - r.s) / 3_600_000;
  if (r.kind === "滞在") {
    const home = /home/i.test(r.type) ? "  ← 自宅" : "";
    console.log(
      `${jst(r.s)} 〜 ${jst(r.e)}  滞在 ${r.type || "-"}  近くの空港 ${airport(r.from)}${home}`,
    );
  } else {
    const straight = r.from && r.to ? km(r.from, r.to) : 0;
    const speed = hours > 0 ? Math.round(straight / hours) : 0;
    console.log(
      `${jst(r.s)} 〜 ${jst(r.e)}  移動 ${r.type}  記録 ${Math.round(r.meters / 1000)} km・直線 ${Math.round(straight)} km・時速 ${speed} km  ${airport(r.from)} → ${airport(r.to)}`,
    );
  }
  // 空港での滞在が重なって複数あることがあるので、終わりが一番遅い記録を「前の記録」にする
  if (!prev || r.e > prev.e) prev = r;
}
console.log(`\n${rows.length} 件（${fromDate} 〜 ${toDate}、日本時間）`);
