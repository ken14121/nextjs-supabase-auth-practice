import type { AddProtocolAction } from "maplibre-gl";

// gsidem://https://… の形で書いた地理院の標高タイル（PNG）を、
// MapLibre が読める Terrarium 形式の画像に変換する。
//
// 地理院の標高 PNG: x = R×65536 + G×256 + B として
//   x < 2^23 なら 標高 = x × 0.01m、x = 2^23 はデータなし、x > 2^23 なら 標高 = (x − 2^24) × 0.01m
// Terrarium: 標高 = R×256 + G + B/256 − 32768

export const GSI_DEM_PROTOCOL = "gsidem";

const TILE_SIZE = 256;

function gsiToMeters(r: number, g: number, b: number): number {
  const x = r * 65536 + g * 256 + b;
  if (x === 2 ** 23) return 0; // データなし（海など）は 0m として扱う
  return (x < 2 ** 23 ? x : x - 2 ** 24) * 0.01;
}

function writeTerrarium(data: Uint8ClampedArray, i: number, meters: number) {
  const v = meters + 32768;
  data[i] = Math.floor(v / 256);
  data[i + 1] = Math.floor(v) % 256;
  data[i + 2] = Math.floor((v - Math.floor(v)) * 256);
  data[i + 3] = 255;
}

// 海の上など、地理院に標高タイルがない場所（404）に使う、全部 0m の平らなタイル
function flatTile(): Promise<ImageBitmap> {
  const image = new ImageData(TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < image.data.length; i += 4) {
    writeTerrarium(image.data, i, 0);
  }
  return createImageBitmap(image);
}

export const gsiDemProtocol: AddProtocolAction = async (
  params,
  abortController,
) => {
  const url = params.url.replace(`${GSI_DEM_PROTOCOL}://`, "");
  const response = await fetch(url, { signal: abortController.signal });
  if (response.status === 404) return { data: await flatTile() };
  if (!response.ok) {
    throw new Error(`標高タイルを読めませんでした（${response.status}）`);
  }

  // 色の補正がかかると標高の値が変わってしまうので、画像をそのままの値で読む
  const source = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const canvas = new OffscreenCanvas(source.width, source.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("標高タイルを変換できませんでした");
  context.drawImage(source, 0, 0);
  source.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height, {
    colorSpace: "srgb",
  });
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    writeTerrarium(data, i, gsiToMeters(data[i], data[i + 1], data[i + 2]));
  }
  return { data: await createImageBitmap(image) };
};
