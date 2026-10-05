import { Button } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { MapVetoPanel } from "@/components/lobby/MapVetoPanel";
import { PlayerCard } from "@/components/lobby/PlayerCard";
import { SpectatorPanel, TeamPanel } from "@/components/lobby/TeamPanel";
import type { Lobby, LobbyAction, User } from "@/lib/types";

type LobbyPlayGridProps = {
  lobby: Lobby;
  currentUser: User | null;
  meInLobby: boolean;
  onAction: (action: LobbyAction) => void;
};

export function LobbyPlayGrid({
  lobby,
  currentUser,
  meInLobby,
  onAction,
}: LobbyPlayGridProps) {
  const navigate = useNavigate();

  function act(action: LobbyAction) {
    onAction(action);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr_1fr]">
      <TeamPanel
        title={lobby.team1Name}
        team="team1"
        players={lobby.team1}
        capacity={lobby.teamSize}
        lobby={lobby}
        currentUser={currentUser}
        accent="team1"
        onJoinTeam={(team) => act({ type: "set_team", team })}
        onMakeCaptain={(userId, team) => act({ type: "set_captain", userId, team })}
      />

      <div className="flex flex-col gap-4">
        <MapVetoPanel
          lobby={lobby}
          currentUser={currentUser}
          onBan={(map) => act({ type: "ban_map", map })}
          onStart={() => act({ type: "start_veto" })}
          onCancel={() => act({ type: "cancel_veto" })}
          onPickManual={(map) => act({ type: "set_map", map })}
        />

        {lobby.unassigned.length > 0 ? (
          <section className="rounded-2xl border border-dashed border-pf-line bg-white/60 p-4">
            <h3 className="mb-3 font-display text-lg font-semibold">Unassigned</h3>
            <div className="flex flex-col gap-2">
              {lobby.unassigned.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </section>
        ) : null}

        <SpectatorPanel
          players={lobby.spectators}
          lobby={lobby}
          currentUser={currentUser}
          onSpectate={() => act({ type: "set_team", team: "spectator" })}
        />

        <section className="rounded-2xl border border-pf-line bg-white/80 p-4">
          <h3 className="font-display text-lg font-semibold">Session</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Start mode" value={lobby.startMode.replace("_", " ")} />
            <Row label="Map mode" value={lobby.mapSelectionMode.replace("_", " ")} />
            <Row label="Privacy" value={lobby.privacy} />
            <Row label="Join teams" value={lobby.allowJoinTeam ? "Allowed" : "Locked"} />
          </dl>

          {meInLobby ? (
            <Button
              className="mt-4"
              variant="danger"
              fullWidth
              onPress={() => {
                act({ type: "leave" });
                void navigate({ to: "/" });
              }}
            >
              Leave lobby
            </Button>
          ) : null}
        </section>
      </div>

      <TeamPanel
        title={lobby.team2Name}
        team="team2"
        players={lobby.team2}
        capacity={lobby.teamSize}
        lobby={lobby}
        currentUser={currentUser}
        accent="team2"
        onJoinTeam={(team) => act({ type: "set_team", team })}
        onMakeCaptain={(userId, team) => act({ type: "set_captain", userId, team })}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-pf-muted">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}
