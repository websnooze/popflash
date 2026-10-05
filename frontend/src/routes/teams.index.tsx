import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useAuth } from "@/hooks/useAuth";
import { teamApi } from "@/lib/client";
import { ApiError } from "@/lib/api";

export function TeamsPage() {
  const { user, isAuthenticated, loginWithSteam } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);

  const query = useQuery({
    queryKey: ["teams", mineOnly],
    queryFn: async () => (await teamApi.list(mineOnly)).teams,
  });

  const createMut = useMutation({
    mutationFn: () => teamApi.create({ name, tag: tag || undefined }),
    onSuccess: ({ team }) => {
      setName("");
      setTag("");
      void qc.invalidateQueries({ queryKey: ["teams"] });
      void navigate({ to: "/teams/$id", params: { id: team.id } });
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

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Liste</h2>
        {isAuthenticated ? (
          <button
            type="button"
            className={`pf-tab ${mineOnly ? "pf-tab-active" : ""}`}
            onClick={() => setMineOnly((v) => !v)}
          >
            {mineOnly ? "Mes équipes" : "Toutes"}
          </button>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2">
        {(query.data ?? []).map((team) => {
          const iAmIn = !!user && team.members.some((m) => m.userId === user.id);
          return (
            <li key={team.id}>
              <Link
                to="/teams/$id"
                params={{ id: team.id }}
                className="flex items-center gap-3 rounded-lg border border-pf-line/80 px-4 py-3 hover:bg-pf-line/20"
              >
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pf-line/50 text-xs font-bold">
                    {(team.tag ?? team.name).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{team.name}</span>
                    {team.tag ? <span className="text-sm text-pf-muted">[{team.tag}]</span> : null}
                    {iAmIn ? (
                      <span className="rounded bg-pf-accent/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Membre
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex -space-x-2">
                    {team.members.slice(0, 5).map((m) =>
                      m.avatarUrl ? (
                        <img
                          key={m.userId}
                          src={m.avatarUrl}
                          alt={m.username}
                          title={m.username}
                          className="h-6 w-6 rounded-full border border-white object-cover"
                        />
                      ) : (
                        <div
                          key={m.userId}
                          title={m.username}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-pf-line/60 text-[9px] font-bold"
                        >
                          {m.username.slice(0, 1).toUpperCase()}
                        </div>
                      ),
                    )}
                    {team.members.length > 5 ? (
                      <span className="pl-3 text-xs text-pf-muted">+{team.members.length - 5}</span>
                    ) : null}
                  </div>
                </div>
                <span className="text-xs text-pf-muted">{team.members.length}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
