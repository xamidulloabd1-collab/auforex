import { AwardIcon, BadgeCheckIcon, BookOpenCheckIcon, FlagIcon, FlameIcon, FootprintsIcon, TargetIcon, TrophyIcon, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  footprints: FootprintsIcon,
  flame: FlameIcon,
  "book-open-check": BookOpenCheckIcon,
  flag: FlagIcon,
  target: TargetIcon,
  "badge-check": BadgeCheckIcon,
  trophy: TrophyIcon,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? AwardIcon;
  return <Icon className={className} />;
}
