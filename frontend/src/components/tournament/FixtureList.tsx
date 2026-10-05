import { Button } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { TournamentFixture } from "@/lib/types";

type Props = {
  fixtures: TournamentFixture[];
  isOrganizer: boolean;
  onOpenLobby?: (fixtureId: string) => void;
  onPatchScore?: (fixtureId: string, score1: number, score2: number) => void;
  pendingId?: string | null;
};

export function FixtureList({ fixtures, isOrganizer, onOpenLobby, onPatchScore, pendingId }: Props) {
  const byRound = fixtures.reduce<Record<string, TournamentFixture[]>>((acc, f) => {
    acc[f.roundKey] ??= [];
    acc[f.roundKey]!.push(f);
    return acc;
  }, {});

  const rounds = Object.keys(byRound).sort();

  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <div key={round}>
          <h3 className="mb-2 font-display text-lg font-semibold uppercase tracking-wide text-pf-muted">
            {round}
          </h3>
          <ul className="space-y-2">
            {byRound[round]!
              .sort((a, b) => a.position - b.position)
              .map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pf-line/80 bg-white/60 px-4 py-3"
                >
                  <div>
                    <span className="font-medium">{f.team1Name ?? "TBD"}</span>
                    <span className="mx-2 text-pf-muted">vs</span>
                    <span className="font-medium">{f.team2Name ?? "TBD"}</span>
                    <span className="ml-3 text-sm text-pf-muted">
                      {f.score1} – {f.score2} · {f.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.lobbyCode ? (
                      <Link
                        to="/lobby/$code"
                        params={{ code: f.lobbyCode }}
                        className="rounded-md px-3 py-1 text-sm font-medium text-pf-muted hover:bg-pf-line/40"
                      >
                        Lobby
                      </Link>
                    ) : null}
                    {isOrganizer && f.team1EntryId && f.team2EntryId && onOpenLobby ? (
                      <Button
                        size="sm"
                        variant="primary"
                        isPending={pendingId === f.id}
                        onPress={() => onOpenLobby(f.id)}
                      >
                        Ouvrir lobby
                      </Button>
                    ) : null}
                    {isOrganizer && onPatchScore ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          const s1 = window.prompt("Score équipe 1", String(f.score1));
                          const s2 = window.prompt("Score équipe 2", String(f.score2));
                          if (s1 != null && s2 != null) {
                            onPatchScore(f.id, Number(s1), Number(s2));
                          }
                        }}
                      >
                        Score
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
