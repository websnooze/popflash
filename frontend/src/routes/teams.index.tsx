import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useAuth } from "@/hooks/useAuth";
import { teamApi } from "@/lib/client";
import { ApiError } from "@/lib/api";

export function TeamsPage() {
  const { isAuthenticated, loginWithSteam } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await teamApi.list()).teams,
  });

  const createMut = useMutation({
    mutationFn: () => teamApi.create({ name, tag: tag || undefined }),
    onSuccess: () => {
      setName("");
      setTag("");
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-pf-ink">Équipes</h1>
      <p className="mt-2 text-pf-muted">Équipes persistantes réutilisables entre tournois.</p>

      {isAuthenticated ? (
        <form
          className="mt-8 flex flex-col gap-3 rounded-xl border border-pf-line/80 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <TextField isRequired>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </TextField>
          <TextField>
            <Label>Tag</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={8} />
          </TextField>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" variant="primary" isPending={createMut.isPending}>
            Créer l&apos;équipe
          </Button>
        </form>
      ) : (
        <Button className="mt-6" variant="primary" onPress={loginWithSteam}>
          Connexion Steam
        </Button>
      )}

      <ul className="mt-8 space-y-2">
        {(query.data ?? []).map((team) => (
          <li key={team.id}>
            <Link
              to="/teams/$id"
              params={{ id: team.id }}
              className="block rounded-lg border border-pf-line/80 px-4 py-3 hover:bg-pf-line/20"
            >
              <span className="font-medium">{team.name}</span>
              {team.tag ? <span className="ml-2 text-sm text-pf-muted">[{team.tag}]</span> : null}
              <span className="ml-2 text-xs text-pf-muted">{team.members.length} membres</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
