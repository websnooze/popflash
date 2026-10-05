import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon, EyeIcon } from "@hugeicons/core-free-icons";
import { PlayerCard } from "./PlayerCard";
import type { Lobby, LobbyPlayer, User } from "@/lib/types";

type TeamPanelProps = {
  title: string;
  team: "team1" | "team2";
  players: LobbyPlayer[];
  capacity: number;
  lobby: Lobby;
  currentUser: User | null;
  onJoinTeam: (team: "team1" | "team2") => void;
  onMakeCaptain: (userId: string, team: "team1" | "team2") => void;
  accent: "team1" | "team2";
};

export function TeamPanel({
  title,
  team,
  players,
  capacity,
  lobby,
  currentUser,
  onJoinTeam,
  onMakeCaptain,
  accent,
}: TeamPanelProps) {
  const isAdmin = currentUser?.id === lobby.hostUserId;
  const me = lobby.players.find((player) => player.userId === currentUser?.id);
  const canJoin =
    Boolean(currentUser) &&
    lobby.allowJoinTeam &&
    lobby.status !== "map_veto" &&
    lobby.status !== "launching" &&
    lobby.status !== "in_match" &&
    players.length < capacity &&
    me?.team !== team;

  return (
    <section className="rounded-2xl border border-pf-line bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-pf-ink">{title}</h2>
          <p className="text-xs text-pf-muted">
            {players.length}/{capacity} players
          </p>
        </div>
        {canJoin ? (
          <Button size="sm" variant="secondary" onPress={() => onJoinTeam(team)}>
            Join
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-pf-line px-3 py-6 text-center text-sm text-pf-muted">
            Waiting for players…
          </p>
        ) : (
          players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              accent={accent}
              actions={
                isAdmin && !player.isCaptain ? (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="Make captain"
                    onPress={() => onMakeCaptain(player.userId, team)}
                  >
                    <HugeiconsIcon icon={CrownIcon} size={16} />
                  </Button>
                ) : null
              }
            />
          ))
        )}
      </div>
    </section>
  );
}

type SpectatorPanelProps = {
  players: LobbyPlayer[];
  lobby: Lobby;
  currentUser: User | null;
  onSpectate: () => void;
};

export function SpectatorPanel({ players, lobby, currentUser, onSpectate }: SpectatorPanelProps) {
  const me = lobby.players.find((player) => player.userId === currentUser?.id);
  const canSpectate =
    Boolean(currentUser) &&
    me?.team !== "spectator" &&
    lobby.status !== "launching" &&
    lobby.status !== "in_match";

  return (
    <section className="rounded-2xl border border-pf-line bg-white/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <HugeiconsIcon icon={EyeIcon} size={18} />
          Spectators
        </h3>
        {canSpectate ? (
          <Button size="sm" variant="ghost" onPress={onSpectate}>
            Spectate
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {players.length === 0 ? (
          <p className="text-sm text-pf-muted">No spectators</p>
        ) : (
          players.map((player) => (
            <PlayerCard key={player.id} player={player} accent="spec" />
          ))
        )}
      </div>
    </section>
  );
}
