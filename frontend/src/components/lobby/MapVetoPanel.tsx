import { Button, Chip } from "@heroui/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { Lobby, User } from "@/lib/types";

type MapVetoPanelProps = {
  lobby: Lobby;
  currentUser: User | null;
  onBan: (map: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onPickManual: (map: string) => void;
};

export function MapVetoPanel({
  lobby,
  currentUser,
  onBan,
  onStart,
  onCancel,
  onPickManual,
}: MapVetoPanelProps) {
  const me = lobby.players.find((player) => player.userId === currentUser?.id);
  const isAdmin = currentUser?.id === lobby.hostUserId;
  const isMyTurn =
    lobby.veto.status === "in_progress" &&
    me?.isCaptain &&
    me.team === lobby.veto.turnTeam;

  if (lobby.veto.status === "in_progress") {
    return (
      <section className="rounded-2xl border border-pf-ink/10 bg-pf-ink p-4 text-white shadow-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Map veto</p>
            <h3 className="font-display text-2xl font-bold">
              {lobby.veto.turnTeam === "team1" ? lobby.team1Name : lobby.team2Name} bans
            </h3>
          </div>
          {isAdmin ? (
            <Button size="sm" variant="danger" onPress={onCancel}>
              Cancel veto
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {lobby.mapPool.map((map) => {
            const banned = lobby.veto.bannedMaps.some((item) => item.map === map);
            const remaining = lobby.veto.remainingMaps.includes(map);
            return (
              <motion.button
                key={map}
                type="button"
                whileTap={isMyTurn && remaining ? { scale: 0.97 } : undefined}
                disabled={!isMyTurn || banned || !remaining}
                onClick={() => onBan(map)}
                className={cn(
                  "rounded-xl border px-3 py-4 text-left transition",
                  banned && "border-white/10 bg-white/5 text-white/35 line-through",
                  remaining && "border-pf-accent/40 bg-white/5 hover:bg-pf-accent/15",
                  isMyTurn && remaining && "cursor-pointer",
                )}
              >
                <span className="font-display text-sm font-semibold uppercase tracking-wide">
                  {map.replace("de_", "")}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-pf-line bg-white/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">Map</h3>
          <p className="text-sm text-pf-muted">
            {lobby.map ? (
              <>
                Selected: <span className="font-semibold text-pf-ink">{lobby.map}</span>
              </>
            ) : (
              "No map selected yet"
            )}
          </p>
        </div>
        <Chip size="sm" variant="soft">
          <Chip.Label>{lobby.mapSelectionMode}</Chip.Label>
        </Chip>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {lobby.mapPool.map((map) => (
          <Button
            key={map}
            size="sm"
            variant={lobby.map === map ? "primary" : "outline"}
            isDisabled={!isAdmin || lobby.status === "map_veto" || lobby.mapSelectionMode !== "host"}
            onPress={() => onPickManual(map)}
          >
            {map.replace("de_", "")}
          </Button>
        ))}
      </div>

      {isAdmin && lobby.mapSelectionMode === "captains_veto" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onPress={onStart}>
            Start captain veto
          </Button>
        </div>
      ) : null}
    </section>
  );
}
