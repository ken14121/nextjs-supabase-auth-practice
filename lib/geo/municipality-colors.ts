// 市区町村の経験値の色（地図帳の墨と朱の濃淡。経験値が高いほど濃い）
export const LEVEL_FILLS: Record<number, string> = {
  5: "#1d1c1a",
  4: "#8f2716",
  3: "#c8432c",
  2: "#df8e78",
  1: "#efc3b6",
  0: "#e4ddcf",
};

export const LEVEL_NAMES: Record<number, string> = {
  5: "住居",
  4: "宿泊",
  3: "訪問",
  2: "接地",
  1: "通過",
  0: "未踏",
};
