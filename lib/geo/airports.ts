import { JA_NAMES } from "./airport-names";
import airportData from "./data/airports.json";

// 空港の一覧（OurAirports、パブリックドメイン。作り方は scripts/build-airport-data.mjs）から、
// 緯度経度に一番近い空港を探す。飛行機の移動の始点・終点から、出発・到着の空港を決めるのに使う

type AirportRow = [
  iata: string,
  lat: number,
  lng: number,
  country: string,
  city: string,
];
const AIRPORTS = airportData as AirportRow[];

// 飛行機の移動の始点・終点がこれより遠いと、空港は「わからない」にする
const MAX_AIRPORT_KM = 60;

function roughKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111.2;
}

export type AirportHit = { code: string; km: number };

// 一番近い空港と、そこまでの距離。近くに空港が無い → null
export function findAirport(lat: number, lng: number): AirportHit | null {
  let best: AirportHit | null = null;
  for (const [iata, aLat, aLng] of AIRPORTS) {
    if (Math.abs(aLat - lat) > 1 || Math.abs(aLng - lng) > 1.5) continue;
    const km = roughKm(lat, lng, aLat, aLng);
    if (km <= MAX_AIRPORT_KM && (!best || km < best.km)) {
      best = { code: iata, km };
    }
  }
  return best;
}

// 例: 羽田空港の近く → "HND"。近くに空港が無い → null
export function nearestAirport(lat: number, lng: number): string | null {
  return findAirport(lat, lng)?.code ?? null;
}

// 一覧にある空港か（本人が空港を直すときに確かめる）
export function isKnownAirport(iata: string): boolean {
  return AIRPORTS.some((a) => a[0] === iata);
}

// 2 つの空港のあいだの直線距離（km）。どちらかが分からなければ null
export function airportDistanceKm(from: string, to: string): number | null {
  const a = AIRPORTS.find((r) => r[0] === from);
  const b = AIRPORTS.find((r) => r[0] === to);
  if (!a || !b) return null;
  const R = 6371;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
    Math.cos(rad(a[1])) *
      Math.cos(rad(b[1])) *
      Math.sin(rad(b[2] - a[2]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type AirportLabel = { code: string; city: string; country: string };

// "KMJ" → { code: "KMJ", city: "熊本", country: "JP" }
export function airportLabel(iata: string | null): AirportLabel {
  if (!iata) return { code: "???", city: "不明", country: "" };
  const row = AIRPORTS.find((a) => a[0] === iata);
  return {
    code: iata,
    city: JA_NAMES[iata] ?? row?.[4] ?? iata,
    country: row?.[3] ?? "",
  };
}
