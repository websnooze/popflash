import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { teamApi } from "@/lib/client";
import { ApiError } from "@/lib/api";

type ConfirmAction =
  | { type: "kick"; userId: string; username: string }
  | { type: "leave" }
  | { type: "delete" }
  | null;

export function TeamDetailPage() {
  const { id } = useParams({ from: "/teams/$id" });
  const { user, isAuthenticated, loginWithSteam } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const query = useQuery({
    queryKey: ["team", id],
    queryFn: async () => (await teamApi.get(id)).team,
  });

  const team = query.data;
  const isCaptain = !!user && team?.captainUserId === user.id;
  const isMember = !!user && team?.members.some((m) => m.userId === user.id);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["team", id] });

  const updateMut = useMutation({
    mutationFn: () =>
      teamApi.update(id, {
        name: name.trim(),
        tag: tag.trim() || undefined,
        logoUrl: logoUrl.trim() || null,
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const regenMut = useMutation({
    mutationFn: () => teamApi.regenerateInvite(id),
    onSuccess: invalidate,
  });

  const roleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      teamApi.updateMemberRole(id, userId, role),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const kickMut = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(id, userId),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const leaveMut = useMutation({
    mutationFn: () => teamApi.leave(id),
    onSuccess: () => void navigate({ to: "/teams" }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const deleteMut = useMutation({
    mutationFn: () => teamApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teams"] });
      void navigate({ to: "/teams" });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  if (query.isLoading || !team) {
    return <p className="p-10 text-center text-pf-muted">Chargement…</p>;
  }

  async function copyInvite() {
    if (!team?.inviteUrl) return;
    await navigator.clipboard.writeText(team.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-pf-line/50 font-display text-xl font-bold">
              {(team.tag ?? team.name).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold text-pf-ink">{team.name}</h1>
            {team.tag ? <p className="text-pf-muted">[{team.tag}]</p> : null}
            <p className="mt-1 text-xs text-pf-muted">{team.members.length} joueurs</p>
          </div>
        </div>
        {isCaptain ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setName(team.name);
              setTag(team.tag ?? "");
              setLogoUrl(team.logoUrl ?? "");
              setEditing((v) => !v);
            }}
          >
            {editing ? "Annuler" : "Éditer"}
          </Button>
        ) : null}
      </div>

      {editing && isCaptain ? (
        <form
          className="mt-6 space-y-3 rounded-xl border border-pf-line/80 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateMut.mutate();
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
          <TextField>
            <Label>Logo (URL)</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </TextField>
          <Button type="submit" variant="primary" isPending={updateMut.isPending}>
            Enregistrer
          </Button>
        </form>
      ) : null}

      {isCaptain && team.inviteUrl ? (
        <div className="mt-6 rounded-xl border border-pf-line/80 bg-white/70 p-4">
          <p className="text-sm font-semibold text-pf-ink">Lien d&apos;invitation</p>
          <p className="mt-1 break-all font-mono text-xs text-pf-muted">{team.inviteUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onPress={() => void copyInvite()}>
              {copied ? "Copié !" : "Copier le lien"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isPending={regenMut.isPending}
              onPress={() => regenMut.mutate()}
            >
              Régénérer
            </Button>
          </div>
        </div>
      ) : null}

      <h2 className="mt-8 font-display text-lg font-semibold">Roster</h2>
      <ul className="mt-3 space-y-2">
        {team.members.map((m) => (
          <li
            key={m.userId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pf-line/80 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pf-line/60 text-xs font-bold">
                  {m.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-pf-ink">
                  {m.profileUrl ? (
                    <a href={m.profileUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {m.username}
                    </a>
                  ) : (
                    m.username
                  )}
                </p>
                <p className="truncate font-mono text-xs text-pf-muted">{m.steamId64}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-pf-line/40 px-2 py-0.5 text-xs uppercase tracking-wide text-pf-muted">
                {m.role}
              </span>
              {isCaptain && m.userId !== user?.id ? (
                <>
                  {m.role !== "captain" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => roleMut.mutate({ userId: m.userId, role: "captain" })}
                    >
                      Capitaine
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      roleMut.mutate({
                        userId: m.userId,
                        role: m.role === "coach" ? "player" : "coach",
                      })
                    }
                  >
                    {m.role === "coach" ? "Joueur" : "Coach"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    isPending={kickMut.isPending}
                    onPress={() => setConfirm({ type: "kick", userId: m.userId, username: m.username })}
                  >
                    Retirer
                  </Button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-8 flex flex-wrap gap-2">
        {!isAuthenticated ? (
          <Button variant="primary" onPress={loginWithSteam}>
            Connexion Steam
          </Button>
        ) : null}
        {isMember && !isCaptain ? (
          <Button variant="ghost" isPending={leaveMut.isPending} onPress={() => setConfirm({ type: "leave" })}>
            Quitter l&apos;équipe
          </Button>
        ) : null}
        {isCaptain ? (
          <Button variant="danger" isPending={deleteMut.isPending} onPress={() => setConfirm({ type: "delete" })}>
            Supprimer l&apos;équipe
          </Button>
        ) : null}
        <Link to="/teams" className="self-center text-sm text-pf-muted hover:underline">
          ← Toutes les équipes
        </Link>
      </div>

      <ConfirmDialog
        open={confirm?.type === "kick"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Retirer un membre"
        description={
          confirm?.type === "kick"
            ? `Retirer ${confirm.username} de l’équipe ? Cette action est immédiate.`
            : ""
        }
        confirmLabel="Retirer"
        isPending={kickMut.isPending}
        onConfirm={() => {
          if (confirm?.type === "kick") kickMut.mutate(confirm.userId);
        }}
      />
      <ConfirmDialog
        open={confirm?.type === "leave"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Quitter l’équipe"
        description="Tu ne feras plus partie du roster. Tu pourras rejoindre via un nouveau lien d’invitation."
        confirmLabel="Quitter"
        tone="warning"
        isPending={leaveMut.isPending}
        onConfirm={() => leaveMut.mutate()}
      />
      <ConfirmDialog
        open={confirm?.type === "delete"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Supprimer l’équipe"
        description="Cette action est définitive. L’équipe et son roster seront supprimés."
        confirmLabel="Supprimer"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />
    </div>
  );
}
