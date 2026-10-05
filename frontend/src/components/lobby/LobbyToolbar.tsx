import { useEffect, useState } from "react";
import { Button, Chip } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDataTransferHorizontalIcon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import type { Lobby, MatchConnectInfo, MatchView, User } from "@/lib/types";

type LobbyToolbarProps = {
  lobby: Lobby;
  currentUser: User | null;
  match: MatchView | null;
  onReady: () => void;
  onScramble: () => void;
  onLaunch: () => void;
  onCopyLink: () => void;
};

export function LobbyToolbar({
  lobby,
  currentUser,
  match,
  onReady,
  onScramble,
  onLaunch,
  onCopyLink,
}: LobbyToolbarProps) {
  const me = lobby.players.find((player) => player.userId === currentUser?.id);
  const isAdmin = currentUser?.id === lobby.hostUserId;
  const canReady = me && (me.team === "team1" || me.team === "team2");
  const connect = match?.connect;
  const secondsLeft = useCountdown(lobby.readyCheck.endsAt, lobby.readyCheck.active);

  return (
    <section className="rounded-2xl border border-pf-line bg-white/90 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip size="sm" variant="soft">
          <Chip.Label>#{lobby.code}</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft">
          <Chip.Label>{lobby.status.replaceAll("_", " ")}</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft">
          <Chip.Label>{lobby.startMode.replaceAll("_", " ")}</Chip.Label>
        </Chip>
        {!lobby.allowJoinTeam ? (
          <Chip size="sm" variant="soft">
            <Chip.Label>Teams locked</Chip.Label>
          </Chip>
        ) : null}
      </div>

      {lobby.readyCheck.active ? (
        <div className="mb-3 rounded-xl bg-pf-ink px-4 py-3 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">Ready check</p>
          <p className="font-display text-3xl font-bold text-pf-accent">{secondsLeft}s</p>
          <p className="text-sm text-white/70">
            Everyone on a team must click Ready before the timer ends.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onPress={onCopyLink}>
          <HugeiconsIcon icon={Copy01Icon} size={16} />
          Copy invite
        </Button>

        {canReady ? (
          <Button size="sm" variant={me?.isReady ? "secondary" : "primary"} onPress={onReady}>
            {me?.isReady ? "Unready" : "Ready"}
          </Button>
        ) : null}

        {isAdmin ? (
          <>
            <Button size="sm" variant="ghost" onPress={onScramble}>
              <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={16} />
              Scramble
            </Button>
            <Button
              size="sm"
              variant="primary"
              isDisabled={lobby.status === "map_veto" || lobby.status === "launching"}
              onPress={onLaunch}
            >
              {lobby.startMode === "when_ready"
                ? lobby.readyCheck.active
                  ? "Ready check running…"
                  : "Start ready check"
                : "Launch match"}
            </Button>
          </>
        ) : null}

        {!isAdmin && lobby.startMode === "when_ready" && !lobby.readyCheck.active ? (
          <Button size="sm" variant="secondary" onPress={onLaunch}>
            Start ready check
          </Button>
        ) : null}
      </div>

      {connect ? <ConnectBanner connect={connect} /> : null}
    </section>
  );
}

function ConnectBanner({ connect }: { connect: MatchConnectInfo }) {
  return (
    <div className="mt-4 rounded-xl bg-pf-ink px-4 py-3 text-white">
      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Server ready</p>
      <p className="mt-1 font-mono text-sm">{connect.connectString}</p>
      <Button
        className="mt-3"
        size="sm"
        variant="primary"
        onPress={() => void navigator.clipboard.writeText(connect.connectString)}
      >
        Copy connect
      </Button>
    </div>
  );
}

function useCountdown(endsAt: string | null, active: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active || !endsAt) {
      setSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [endsAt, active]);

  return seconds;
}
