import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Button, Card } from "@heroui/react";
import { BracketCanvas } from "@/components/tournament/BracketCanvas";
import { FixtureList } from "@/components/tournament/FixtureList";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { TournamentMatchSettingsModal } from "@/components/tournament/TournamentMatchSettingsModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { teamApi, tournamentApi } from "@/lib/client";
import { DATHOST_LOCATIONS } from "@/lib/lobby-options";
import { normalizeTournamentSettings } from "@/lib/tournament-settings";
import type { TournamentFixture } from "@/lib/types";

export function TournamentDetailPage() {
  const { slug } = useParams({ from: "/tournaments/$slug" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [selectedFixture, setSelectedFixture] = useState<TournamentFixture | null>(null);
  const [pendingLobby, setPendingLobby] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [withdrawEntryId, setWithdrawEntryId] = useState<string | null>(null);

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
  const matchSettings = normalizeTournamentSettings(t?.settings);

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

  const settingsMut = useMutation({
    mutationFn: (body: { teamSize: number; settings: typeof matchSettings }) =>
      tournamentApi.update(t!.id, body),
    onSuccess: () => {
      setSettingsOpen(false);
      invalidate();
    },
  });

  const withdrawMut = useMutation({
    mutationFn: (entryId: string) => tournamentApi.withdraw(t!.id, entryId),
    onSuccess: invalidate,
  });

  const checkInMut = useMutation({
    mutationFn: (entryId: string) => tournamentApi.checkIn(t!.id, entryId),
    onSuccess: invalidate,
  });

  const cancelMut = useMutation({
    mutationFn: () => tournamentApi.cancel(t!.id),
    onSuccess: invalidate,
  });

  if (query.isLoading || !t) {
    return <p className="p-10 text-center text-pf-muted">Chargement…</p>;
  }

  const myTeams = (teamsQuery.data ?? []).filter((team) => team.captainUserId === user?.id);
  const myCaptainTeamIds = new Set(myTeams.map((team) => team.id));
  const locationLabel =
    DATHOST_LOCATIONS.find((l) => l.id === matchSettings.location)?.label ?? matchSettings.location;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "teams", label: "Équipes" },
    { id: "bracket", label: "Bracket" },
    ...(isOrganizer ? [{ id: "settings", label: "Settings" }] : []),
  ] as const;

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
            {t.format.replace("_", " ")} · {t.teamSize}v{t.teamSize} · {t.entryCount}/{t.maxTeams} ·{" "}
            {t.status}
          </p>
          {isOrganizer ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {t.status === "draft" ? (
                <Button
                  size="sm"
                  variant="primary"
                  isPending={publishMut.isPending}
                  onPress={() => publishMut.mutate()}
                >
                  Publier (inscriptions)
                </Button>
              ) : null}
              {t.status === "registration" || t.status === "seeding" ? (
                <Button
                  size="sm"
                  variant="primary"
                  isPending={bracketMut.isPending}
                  onPress={() => bracketMut.mutate()}
                >
                  Générer le bracket
                </Button>
              ) : null}
              {t.status !== "canceled" && t.status !== "completed" ? (
                <Button
                  size="sm"
                  variant="danger"
                  isPending={cancelMut.isPending}
                  onPress={() => setConfirmCancel(true)}
                >
                  Annuler le tournoi
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 border-b border-pf-line pb-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`pf-tab ${tab === entry.id ? "pf-tab-active" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="pt-6">
          <Card className="border border-pf-line/80 p-4">
            <p className="text-sm text-pf-muted">
              Mode : {t.teamSize}v{t.teamSize} · BO{matchSettings.bestOf} · {locationLabel} · Check-in :{" "}
              {t.checkInRequired ? "oui" : "non"}
            </p>
            {t.startsAt ? (
              <p className="mt-2 text-sm">Début : {new Date(t.startsAt).toLocaleString()}</p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "teams" ? (
        <div className="space-y-4 pt-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {(t.entries ?? [])
              .filter((e) => e.status !== "withdrawn")
              .map((e) => {
                const canManage = isOrganizer || myCaptainTeamIds.has(e.teamId);
                return (
                  <li key={e.id} className="rounded-xl border border-pf-line/80 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to="/teams/$id"
                          params={{ id: e.teamId }}
                          className="font-medium hover:underline"
                        >
                          {e.teamName}
                        </Link>
                        {e.seed != null ? (
                          <span className="ml-2 text-xs text-pf-muted">Seed {e.seed}</span>
                        ) : null}
                        <span className="ml-2 text-xs text-pf-muted">{e.status}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(e.members ?? []).map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center gap-2 rounded-full border border-pf-line/70 bg-white/70 py-1 pl-1 pr-2"
                          title={`${m.username} · ${m.steamId64}`}
                        >
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pf-line/50 text-[10px] font-bold">
                              {m.username.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="max-w-24 truncate text-xs">{m.username}</span>
                        </div>
                      ))}
                    </div>
                    {canManage && (t.status === "registration" || t.status === "check_in" || t.status === "draft") ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {t.checkInRequired && e.status === "accepted" && myCaptainTeamIds.has(e.teamId) ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            isPending={checkInMut.isPending}
                            onPress={() => checkInMut.mutate(e.id)}
                          >
                            Check-in
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          isPending={withdrawMut.isPending}
                          onPress={() => setWithdrawEntryId(e.id)}
                        >
                          Se désinscrire
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
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
            scorePending={patchMut.isPending}
            onOpenLobby={(id) => openLobbyMut.mutate(id)}
            onPatchScore={(id, score1, score2) => patchMut.mutate({ id, score1, score2 })}
          />
          {selectedFixture ? (
            <Card className="border border-pf-accent/40 p-4">
              <p className="font-medium">
                {selectedFixture.team1Name} vs {selectedFixture.team2Name}
              </p>
              <p className="text-sm text-pf-muted">
                {selectedFixture.roundKey} · {selectedFixture.status}
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "settings" && isOrganizer ? (
        <div className="space-y-4 pt-6">
          <Card className="border border-pf-line/80 p-4">
            <h2 className="font-display text-xl font-semibold text-pf-ink">
              Paramètres des matchs
            </h2>
            <p className="mt-2 text-sm text-pf-muted">
              Mode {t.teamSize}v{t.teamSize} · BO{matchSettings.bestOf} · {locationLabel} · sélection
              map : {matchSettings.mapSelectionMode} · {matchSettings.mapPool.length} maps · knife{" "}
              {matchSettings.matchSettings.knifeRound ? "on" : "off"} · max rounds{" "}
              {matchSettings.matchSettings.maxRounds}
            </p>
            <Button className="mt-4" variant="primary" onPress={() => setSettingsOpen(true)}>
              Advanced Settings
            </Button>
          </Card>
        </div>
      ) : null}

      <TournamentMatchSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAdmin={isOrganizer}
        teamSize={t.teamSize}
        settings={matchSettings}
        isSaving={settingsMut.isPending}
        onSave={(next) => settingsMut.mutate(next)}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Annuler le tournoi"
        description="Le tournoi passera en statut canceled. Les inscriptions et brackets ne seront plus utilisables."
        confirmLabel="Annuler le tournoi"
        isPending={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate()}
      />
      <ConfirmDialog
        open={!!withdrawEntryId}
        onOpenChange={(open) => {
          if (!open) setWithdrawEntryId(null);
        }}
        title="Se désinscrire"
        description="L’équipe sera retirée du tournoi. Tu pourras te réinscrire tant que les inscriptions sont ouvertes."
        confirmLabel="Se désinscrire"
        tone="warning"
        isPending={withdrawMut.isPending}
        onConfirm={() => {
          if (withdrawEntryId) withdrawMut.mutate(withdrawEntryId);
        }}
      />
    </div>
  );
}
