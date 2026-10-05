import { Avatar, Chip } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon, CheckmarkCircle01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { LobbyPlayer } from "@/lib/types";

type PlayerCardProps = {
  player: LobbyPlayer;
  accent?: "team1" | "team2" | "spec" | "neutral";
  actions?: React.ReactNode;
};

export function PlayerCard({ player, accent = "neutral", actions }: PlayerCardProps) {
  const ring =
    accent === "team1"
      ? "border-pf-team1/40"
      : accent === "team2"
        ? "border-pf-team2/40"
        : accent === "spec"
          ? "border-pf-spec/30"
          : "border-pf-line";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-white/90 px-3 py-2.5 shadow-sm",
        ring,
      )}
    >
      <Avatar size="sm">
        {player.avatarUrl ? <Avatar.Image src={player.avatarUrl} alt={player.username} /> : null}
        <Avatar.Fallback>
          <HugeiconsIcon icon={UserIcon} size={14} />
        </Avatar.Fallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-pf-ink">{player.username}</p>
          {player.isCaptain ? (
            <HugeiconsIcon icon={CrownIcon} size={14} className="shrink-0 text-amber-500" />
          ) : null}
          {player.isAdmin ? (
            <Chip size="sm" variant="soft">
              <Chip.Label>Admin</Chip.Label>
            </Chip>
          ) : null}
        </div>
        <p className="text-xs text-pf-muted">
          {player.isReady ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} /> Ready
            </span>
          ) : (
            "Not ready"
          )}
        </p>
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
