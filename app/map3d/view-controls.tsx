"use client";

import { cn } from "cn";
import {
  ChevronDown,
  ChevronUp,
  Move,
  Rotate3d,
  RotateCcw,
  RotateCw,
  ScanEye,
} from "lucide-react";
import type { ReactNode } from "react";

// 画面右下の操作パネル。モードの切り替えと、ボタンで回転・傾きを変える

export type GestureMode = "pan" | "orbit";

const MODES: { value: GestureMode; label: string; icon: ReactNode }[] = [
  { value: "pan", label: "移動", icon: <Move className="size-4" /> },
  {
    value: "orbit",
    label: "回転・傾き",
    icon: <Rotate3d className="size-4" />,
  },
];

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-muted active:bg-muted/70"
    >
      {children}
    </button>
  );
}

export function ViewControls({
  mode,
  onModeChange,
  onRotate,
  onTilt,
  onReset,
}: {
  mode: GestureMode;
  onModeChange: (mode: GestureMode) => void;
  onRotate: (degrees: number) => void;
  onTilt: (degrees: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <fieldset className="flex rounded-md bg-background/90 p-1 text-sm shadow backdrop-blur">
        <legend className="sr-only">ドラッグ・スワイプでの操作</legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors",
              mode === m.value
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name="gesture-mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => onModeChange(m.value)}
              className="sr-only"
            />
            {m.icon}
            {m.label}
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-3 rounded-md bg-background/90 p-1 shadow backdrop-blur">
        <span />
        <IconButton label="奥へ傾ける" onClick={() => onTilt(15)}>
          <ChevronUp className="size-5" />
        </IconButton>
        <span />
        <IconButton label="左に回す" onClick={() => onRotate(-30)}>
          <RotateCcw className="size-4" />
        </IconButton>
        <IconButton label="真上から見る（北を上に）" onClick={onReset}>
          <ScanEye className="size-4" />
        </IconButton>
        <IconButton label="右に回す" onClick={() => onRotate(30)}>
          <RotateCw className="size-4" />
        </IconButton>
        <span />
        <IconButton label="手前に起こす" onClick={() => onTilt(-15)}>
          <ChevronDown className="size-5" />
        </IconButton>
        <span />
      </div>
    </div>
  );
}
