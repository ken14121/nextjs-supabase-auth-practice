import {
  Camera,
  Coffee,
  Flower2,
  Heart,
  MapPin,
  Moon,
  Mountain,
  Music,
  Plane,
  Sparkles,
  Star,
  Sun,
  TrainFront,
  Waves,
} from "lucide-react";
import type { TicketMark } from "@/lib/outings/ticket-style";

// 切符の帯に出すマーク（lib/outings/ticket-style.ts の TICKET_MARKS）
const ICONS: Record<TicketMark, typeof Plane> = {
  plane: Plane,
  train: TrainFront,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  sun: Sun,
  moon: Moon,
  mountain: Mountain,
  waves: Waves,
  flower: Flower2,
  camera: Camera,
  coffee: Coffee,
  music: Music,
  pin: MapPin,
};

export function TicketMarkIcon({
  mark,
  className,
}: {
  mark: TicketMark;
  className?: string;
}) {
  const Icon = ICONS[mark];
  return <Icon className={className} aria-hidden="true" />;
}
