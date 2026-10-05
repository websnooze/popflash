import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Button, Card } from "@heroui/react";
import { BracketCanvas } from "@/components/tournament/BracketCanvas";
import { FixtureList } from "@/components/tournament/FixtureList";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { useAuth } from "@/hooks/useAuth";
import { teamApi, tournamentApi } from "@/lib/client";
import type { TournamentFixture } from "@/lib/types";

export function TournamentDetailPage() {
  const { slug } = useParams({ from: "/tournaments/$slug" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [selectedFixture, setSelectedFixture] = useState<TournamentFixture | null>(null);
  const [pendingLobby, setPendingLobby] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["tournament", slug],
    queryFn: async () => (await tournamentApi.getBySlug(slug)).tournament,
  });

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await teamApi.list()).teams,
    enabled: !!user,
  });

  const t = query.data;
  const isOrganizer = !!user && t?.organizerUserId === user.id;
  const isSwissOrRr = t?.format === "swiss" || t?.format === "round_robin";

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["tournament", slug] });

  const publishMut = useMutation({
    mutationFn: () => tournamentApi.publish(t!.id),
    onSuccess: invalidate,
  });

  const bracketMut = useMutation({
    mutationFn: () => tournamentApi.generateBracket(t!.id, true),
    onSuccess: invalidate,
  });

  const registerMut = useMutation({
    mutationFn: (teamId: string) => tournamentApi.register(t!.id, teamId),
    onSuccess: invalidate,
  });

  const openLobbyMut = useMutation({
    mutationFn: (matchId: string) => {
      setPendingLobby(matchId);
      return tournamentApi.openLobby(t!.id, matchId);
    },
    onSettled: () => setPendingLobby(null),
    onSuccess: invalidate,
  });

  const patchMut = useMutation({
    mutationFn: ({ id, score1, score2 }: { id: string; score1: number; score2: number }) =>
      tournamentApi.patchFixture(t!.id, id, { score1, score2 }),
    onSuccess: invalidate,
  });

  if (query.isLoading || !t) {
    return <p className="p-10 text-center text-pf-muted">Chargement…</p>;
  }

  const myTeams = (teamsQuery.data ?? []).filter((team) => team.captainUserId === user?.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap gap-6">
        {t.imageUrl ? (
          <img src={t.imageUrl} alt="" className="h-40 w-64 rounded-xl object-cover" />
        ) : null}
        <div className="flex-1">
          <h1 className="font-display text-4xl font-bold text-pf-ink">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-pf-muted">{t.description}</p>
          <p className="mt-2 text-sm uppercase tracking-wide text-pf-muted">
            {t.format.replace("_", " ")} · {t.entryCount}/{t.maxTeams} · {t.status}
          </p>
          {isOrganizer ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {t.status === "draft" ? (
                <Button size="sm" variant="primary" isPending={publishMut.isPending} onPress={() => publishMut.mutate()}>
                  Publier (inscriptions)
                </Button>
              ) : null}
              {t.status === "registration" || t.status === "seeding" ? (
                <Button size="sm" variant="primary" isPending={bracketMut.isPending} onPress={() => bracketMut.mutate()}>
                  Générer le bracket
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 border-b border-pf-line pb-2">
        {(["overview", "teams", "bracket"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`pf-tab ${tab === id ? "pf-tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {id === "overview" ? "Overview" : id === "teams" ? "Équipes" : "Bracket"}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="pt-6">
          <Card className="border border-pf-line/80 p-4">
            <p className="text-sm text-pf-muted">
              Taille d&apos;équipe : {t.teamSize} · Check-in : {t.checkInRequired ? "oui" : "non"}
            </p>
            {t.startsAt ? (
              <p className="mt-2 text-sm">Début : {new Date(t.startsAt).toLocaleString()}</p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "teams" ? (
        <div className="space-y-4 pt-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {(t.entries ?? []).map((e) => (
              <li key={e.id} className="rounded-lg border border-pf-line/80 px-4 py-3">
                <Link to="/teams/$id" params={{ id: e.teamId }} className="font-medium hover:underline">
                  {e.teamName}
                </Link>
                {e.seed != null ? <span className="ml-2 text-xs text-pf-muted">Seed {e.seed}</span> : null}
                <span className="ml-2 text-xs text-pf-muted">{e.status}</span>
              </li>
            ))}
          </ul>
          {t.status === "registration" && myTeams.length ? (
            <div className="flex flex-wrap gap-2">
              {myTeams.map((team) => (
                <Button
                  key={team.id}
                  size="sm"
                  variant="ghost"
                  isPending={registerMut.isPending}
                  onPress={() => registerMut.mutate(team.id)}
                >
                  Inscrire {team.name}
                </Button>
              ))}
            </div>
          ) : null}
          <Link to="/teams" className="text-sm font-medium text-pf-accent-ink hover:underline">
            Gérer mes équipes
          </Link>
        </div>
      ) : null}

      {tab === "bracket" ? (
        <div className="space-y-6 pt-6">
          {!isSwissOrRr ? (
            <BracketCanvas
              fixtures={t.fixtures ?? []}
              selectedId={selectedFixture?.id}
              onSelect={setSelectedFixture}
            />
          ) : null}
          {isSwissOrRr ? (
            <StandingsTable standings={t.standings ?? []} entries={t.entries ?? []} />
          ) : null}
          <FixtureList
            fixtures={t.fixtures ?? []}
            isOrganizer={isOrganizer}
            pendingId={pendingLobby}
            onOpenLobby={(id) => openLobbyMut.mutate(id)}
            onPatchScore={(id, score1, score2) => patchMut.mutate({ id, score1, score2 })}
          />
          {selectedFixture ? (
            <Card className="border border-pf-accent/40 p-4">
              <p className="font-medium">
                {selectedFixture.team1Name} vs {selectedFixture.team2Name}
              </p>
              <p className="text-sm text-pf-muted">{selectedFixture.roundKey} · {selectedFixture.status}</p>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
