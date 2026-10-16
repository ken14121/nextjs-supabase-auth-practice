"use client";

import { cn } from "cn";
import { LOOKS, type Look } from "./earth-style";

// 地球儀の見た目（写真 / 線・白 / 線・黒）を選ぶ。選んだものはこのブラウザに覚えておく

const STORAGE_KEY = "map3d-look";

export function readSavedLook(): Look {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LOOKS.find((l) => l.value === saved)?.value ?? "photo";
  } catch {
    // プライベートモードなどで読めないときは、いつもの写真から
    return "photo";
  }
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(STORAGE_KEY, look);
  } catch {
    // 覚えられなくても、切り替え自体はできるので何もしない
  }
}

export function LookSwitch({
  look,
  onChange,
}: {
  look: Look;
  onChange: (look: Look) => void;
}) {
  return (
    <fieldset className="flex w-fit rounded-md bg-background/90 p-1 text-sm shadow backdrop-blur">
      <legend className="sr-only">地球儀の見た目</legend>
      {LOOKS.map((l) => (
        <label
          key={l.value}
          className={cn(
            "cursor-pointer rounded px-2.5 py-1 transition-colors",
            look === l.value
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          <input
            type="radio"
            name="globe-look"
            value={l.value}
            checked={look === l.value}
            onChange={() => onChange(l.value)}
            className="sr-only"
          />
          {l.label}
        </label>
      ))}
    </fieldset>
  );
}
