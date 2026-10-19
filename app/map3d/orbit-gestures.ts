import type { Map as MapLibreMap } from "maplibre-gl";

// 「回転・傾き」モードのときの操作。タッチパッドでも角度を変えられるようにする。
//   ・1 本指（左クリック）でドラッグ: 左右で回転、上下で傾き
//   ・2 本指スワイプ（ホイール）: 左右で回転、上下で傾き
//   ・ピンチ（Ctrl + ホイールとして届く）: いつもどおりズーム
// 「移動」モードのときは何もせず、MapLibre の普通の操作（ドラッグで移動、スワイプでズーム）になる。

const DRAG_BEARING_PER_PX = 0.4;
const DRAG_PITCH_PER_PX = 0.3;
const WHEEL_BEARING_PER_PX = 0.25;
const WHEEL_PITCH_PER_PX = 0.15;
// ホイールが「行」単位で届くとき（マウスのホイールなど）、1 行を何ピクセルとみなすか
const LINE_HEIGHT_PX = 16;

export function attachOrbitGestures(
  map: MapLibreMap,
  isOrbitMode: () => boolean,
): () => void {
  const container = map.getContainer();

  // 今の角度に足して動かす（傾きの上限・下限は MapLibre が自動でおさえる）
  const orbit = (bearingDelta: number, pitchDelta: number) => {
    map.jumpTo({
      bearing: map.getBearing() + bearingDelta,
      pitch: map.getPitch() + pitchDelta,
    });
  };

  const onWheel = (e: WheelEvent) => {
    if (!isOrbitMode() || e.ctrlKey) return;
    // MapLibre のズームまで届かないように、ここで止める
    e.preventDefault();
    e.stopPropagation();
    const scale =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT_PX : 1;
    orbit(
      e.deltaX * scale * WHEEL_BEARING_PER_PX,
      e.deltaY * scale * WHEEL_PITCH_PER_PX,
    );
  };

  let last: { id: number; x: number; y: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    // ボタンやポップアップの上では反応しない（地図そのものを触ったときだけ）
    if (!isOrbitMode() || e.button !== 0 || !e.isPrimary) return;
    if (!(e.target instanceof HTMLCanvasElement)) return;
    last = { id: e.pointerId, x: e.clientX, y: e.clientY };
    container.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!last || e.pointerId !== last.id) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { id: e.pointerId, x: e.clientX, y: e.clientY };
    // 右へドラッグで右回り、上へドラッグで地面を奥へ倒す（MapLibre の右ドラッグと同じ向き）
    orbit(dx * DRAG_BEARING_PER_PX, -dy * DRAG_PITCH_PER_PX);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!last || e.pointerId !== last.id) return;
    last = null;
    if (container.hasPointerCapture(e.pointerId)) {
      container.releasePointerCapture(e.pointerId);
    }
  };

  // capture: true にして、MapLibre より先に受け取る
  container.addEventListener("wheel", onWheel, {
    capture: true,
    passive: false,
  });
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);

  return () => {
    container.removeEventListener("wheel", onWheel, { capture: true });
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerUp);
  };
}
