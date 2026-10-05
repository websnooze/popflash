import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input, Label, TextField, TextArea } from "@heroui/react";
import { FieldSelect } from "@/components/lobby/advanced/SettingsFields";
import { tournamentApi } from "@/lib/client";
import { ApiError } from "@/lib/api";
import type { TournamentFormat } from "@/lib/types";

export function TournamentNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single_elim");
  const [maxTeams, setMaxTeams] = useState(8);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      tournamentApi.create({
        title,
        description,
        imageUrl: imageUrl || undefined,
        format,
        maxTeams,
        teamSize: 5,
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" variant="primary" isPending={mutation.isPending}>
          Créer
        </Button>
      </form>
    </div>
  );
}
