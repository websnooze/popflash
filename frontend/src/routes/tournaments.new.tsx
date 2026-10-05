import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input, Label, TextField, TextArea } from "@heroui/react";
import { FieldSelect } from "@/components/lobby/advanced/SettingsFields";
import { TournamentMatchSettingsModal } from "@/components/tournament/TournamentMatchSettingsModal";
import { tournamentApi } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { GAME_MODES } from "@/lib/lobby-options";
import {
  defaultTournamentSettings,
  type TournamentSettingsDraft,
} from "@/lib/tournament-settings";
import type { TournamentFormat } from "@/lib/types";

export function TournamentNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single_elim");
  const [maxTeams, setMaxTeams] = useState(8);
  const [draft, setDraft] = useState<TournamentSettingsDraft>({
    teamSize: 5,
    settings: defaultTournamentSettings(),
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      tournamentApi.create({
        title,
        description,
        imageUrl: imageUrl || undefined,
        format,
        maxTeams,
        teamSize: draft.teamSize,
        settings: draft.settings,
      }),
    onSuccess: ({ tournament }) => {
      void navigate({ to: "/tournaments/$slug", params: { slug: tournament.slug } });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Échec de la création");
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-pf-ink">Nouveau tournoi</h1>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <TextField isRequired>
          <Label>Titre</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </TextField>
        <TextField>
          <Label>Description</Label>
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </TextField>
        <TextField>
          <Label>Image (URL)</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </TextField>
        <FieldSelect
          label="Format"
          value={format}
          options={[
            { id: "single_elim", label: "Single elimination" },
            { id: "double_elim", label: "Double elimination" },
            { id: "swiss", label: "Swiss" },
            { id: "round_robin", label: "Round robin" },
          ]}
          onChange={(v) => setFormat(v as TournamentFormat)}
        />
        <FieldSelect
          label="Mode"
          value={String(draft.teamSize)}
          options={GAME_MODES.map((mode) => ({
            id: String(mode.teamSize),
            label: mode.label,
          }))}
          onChange={(v) => setDraft((prev) => ({ ...prev, teamSize: Number(v) }))}
        />
        <TextField>
          <Label>Max équipes</Label>
          <Input
            type="number"
            min={2}
            max={128}
            value={String(maxTeams)}
            onChange={(e) => setMaxTeams(Number(e.target.value))}
          />
        </TextField>

        <div className="rounded-xl border border-pf-line/80 bg-white/60 p-4">
          <p className="text-sm font-medium text-pf-ink">Paramètres des matchs</p>
          <p className="mt-1 text-sm text-pf-muted">
            {draft.teamSize}v{draft.teamSize} · BO{draft.settings.bestOf} ·{" "}
            {draft.settings.location} · {draft.settings.mapPool.length} maps
          </p>
          <Button
            type="button"
            className="mt-3"
            size="sm"
            variant="secondary"
            onPress={() => setSettingsOpen(true)}
          >
            Configurer (Advanced Settings)
          </Button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" variant="primary" isPending={mutation.isPending}>
          Créer
        </Button>
      </form>

      <TournamentMatchSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAdmin
        teamSize={draft.teamSize}
        settings={draft.settings}
        onSave={(next) => {
          setDraft(next);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
