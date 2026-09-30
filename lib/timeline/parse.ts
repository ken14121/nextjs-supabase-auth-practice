import { z } from "zod";

// Google マップのタイムライン（スマホから書き出した Timeline.json）を読み、
// アプリで使う最小限の形（滞在と移動だけ）にそろえる。
// ブラウザとサーバーの両方で使うので、Node.js 専用の機能は使わない。

export type LatLng = { lat: number; lng: number };

export type TimelineVisit = {
  kind: "visit";
  start: string;
  end: string;
  location: LatLng;
  isHome: boolean;
};

export type TimelineActivity = {
  kind: "activity";
  start: string;
  end: string;
  from: LatLng;
  to: LatLng;
  distanceMeters: number;
  mode: TransportMode;
};

export type TimelineSegment = TimelineVisit | TimelineActivity;

export const TRANSPORT_MODES = [
  "walk",
  "bicycle",
  "car",
  "bus",
  "train",
  "flight",
  "boat",
  "other",
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export class TimelineFormatError extends Error {}

// ---------------------------------------------------------------------
// 位置と移動手段の読み取り
// ---------------------------------------------------------------------

// iPhone: "geo:35.695743,140.044317"
// Android: "35.695743°, 140.044317°"
function parseLatLng(text: string): LatLng | null {
  const match = text.match(/(-?\d+(?:\.\d+)?)°?,\s*(-?\d+(?:\.\d+)?)°?/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// "in passenger vehicle" / "IN_PASSENGER_VEHICLE" などを、アプリ用の短い名前にそろえる
function toTransportMode(type: string | undefined): TransportMode {
  const t = (type ?? "").toLowerCase();
  if (/train|tram|subway|rail/.test(t)) return "train";
  if (/bus/.test(t)) return "bus";
  if (/fly|plane/.test(t)) return "flight";
  if (/ferry|boat|sailing/.test(t)) return "boat";
  if (/cycl|bicycle/.test(t)) return "bicycle";
  if (/walk|run|foot/.test(t)) return "walk";
  if (/vehicle|car|taxi|motor|driving/.test(t)) return "car";
  return "other";
}

function isHomeType(semanticType: string | undefined): boolean {
  const t = (semanticType ?? "").toLowerCase();
  return t === "home" || t === "inferred_home";
}

// ---------------------------------------------------------------------
// iPhone で書き出した形式（配列）
// 数値がすべて文字列、位置は "geo:緯度,経度"
// ---------------------------------------------------------------------
const iosVisitSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  visit: z.object({
    topCandidate: z.object({
      semanticType: z.string().optional(),
      placeLocation: z.string(),
    }),
  }),
});

const iosActivitySchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  activity: z.object({
    start: z.string(),
    end: z.string(),
    distanceMeters: z.coerce.number().optional(),
    topCandidate: z.object({ type: z.string() }).optional(),
  }),
});

// ---------------------------------------------------------------------
// Android で書き出した形式（semanticSegments の中）
// 位置は { latLng: "緯度°, 経度°" }
// ---------------------------------------------------------------------
const androidLatLngSchema = z.object({ latLng: z.string() });

const androidVisitSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  visit: z.object({
    topCandidate: z.object({
      semanticType: z.string().optional(),
      placeLocation: androidLatLngSchema,
    }),
  }),
});

const androidActivitySchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  activity: z.object({
    start: androidLatLngSchema,
    end: androidLatLngSchema,
    distanceMeters: z.coerce.number().optional(),
    topCandidate: z.object({ type: z.string() }).optional(),
  }),
});

const androidFileSchema = z.object({
  semanticSegments: z.array(z.unknown()),
});

function isValidTime(text: string): boolean {
  return !Number.isNaN(Date.parse(text));
}

function toVisit(
  startTime: string,
  endTime: string,
  locationText: string,
  semanticType: string | undefined,
): TimelineVisit | null {
  const location = parseLatLng(locationText);
  if (!location || !isValidTime(startTime) || !isValidTime(endTime)) {
    return null;
  }
  return {
    kind: "visit",
    start: new Date(startTime).toISOString(),
    end: new Date(endTime).toISOString(),
    location,
    isHome: isHomeType(semanticType),
  };
}

function toActivity(
  startTime: string,
  endTime: string,
  fromText: string,
  toText: string,
  distanceMeters: number | undefined,
  type: string | undefined,
): TimelineActivity | null {
  const from = parseLatLng(fromText);
  const to = parseLatLng(toText);
  if (!from || !to || !isValidTime(startTime) || !isValidTime(endTime)) {
    return null;
  }
  return {
    kind: "activity",
    start: new Date(startTime).toISOString(),
    end: new Date(endTime).toISOString(),
    from,
    to,
    distanceMeters:
      distanceMeters && Number.isFinite(distanceMeters) ? distanceMeters : 0,
    mode: toTransportMode(type),
  };
}

function readIosItem(item: unknown): TimelineSegment | null {
  const visit = iosVisitSchema.safeParse(item);
  if (visit.success) {
    const { startTime, endTime, visit: v } = visit.data;
    return toVisit(
      startTime,
      endTime,
      v.topCandidate.placeLocation,
      v.topCandidate.semanticType,
    );
  }
  const activity = iosActivitySchema.safeParse(item);
  if (activity.success) {
    const { startTime, endTime, activity: a } = activity.data;
    return toActivity(
      startTime,
      endTime,
      a.start,
      a.end,
      a.distanceMeters,
      a.topCandidate?.type,
    );
  }
  return null;
}

function readAndroidItem(item: unknown): TimelineSegment | null {
  const visit = androidVisitSchema.safeParse(item);
  if (visit.success) {
    const { startTime, endTime, visit: v } = visit.data;
    return toVisit(
      startTime,
      endTime,
      v.topCandidate.placeLocation.latLng,
      v.topCandidate.semanticType,
    );
  }
  const activity = androidActivitySchema.safeParse(item);
  if (activity.success) {
    const { startTime, endTime, activity: a } = activity.data;
    return toActivity(
      startTime,
      endTime,
      a.start.latLng,
      a.end.latLng,
      a.distanceMeters,
      a.topCandidate?.type,
    );
  }
  return null;
}

// Timeline.json の中身（JSON.parse した結果）から、滞在と移動だけを取り出す。
// 移動の軌跡（timelinePath）など、使わない部分はここで捨てる。
export function extractSegments(json: unknown): {
  segments: TimelineSegment[];
  skipped: number;
} {
  let items: unknown[];
  let readItem: (item: unknown) => TimelineSegment | null;

  if (Array.isArray(json)) {
    items = json;
    readItem = readIosItem;
  } else {
    const android = androidFileSchema.safeParse(json);
    if (!android.success) {
      throw new TimelineFormatError(
        "Google マップのタイムラインのファイルではないようです。スマホのタイムラインから書き出した Timeline.json を選んでください。",
      );
    }
    items = android.data.semanticSegments;
    readItem = readAndroidItem;
  }

  const segments: TimelineSegment[] = [];
  let skipped = 0;
  for (const item of items) {
    const segment = readItem(item);
    if (segment) {
      segments.push(segment);
    } else {
      skipped++;
    }
  }

  if (segments.length === 0) {
    throw new TimelineFormatError(
      "滞在や移動の記録が見つかりませんでした。タイムラインが空でないか確認してください。",
    );
  }

  segments.sort((a, b) => a.start.localeCompare(b.start));
  return { segments, skipped };
}

// ---------------------------------------------------------------------
// ブラウザ → サーバーへ送る、小さくまとめた形
// サーバーは送られてきた中身を信用せず、必ずこのスキーマで確かめる
// ---------------------------------------------------------------------
const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const isoDateTime = z.iso.datetime();

export const compactTimelineSchema = z.object({
  version: z.literal(1),
  segments: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("visit"),
          start: isoDateTime,
          end: isoDateTime,
          location: latLngSchema,
          isHome: z.boolean(),
        }),
        z.object({
          kind: z.literal("activity"),
          start: isoDateTime,
          end: isoDateTime,
          from: latLngSchema,
          to: latLngSchema,
          distanceMeters: z.number().min(0),
          mode: z.enum(TRANSPORT_MODES),
        }),
      ]),
    )
    .min(1),
});

export type CompactTimeline = z.infer<typeof compactTimelineSchema>;
