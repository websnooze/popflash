import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@heroui/react";
import { useAuth } from "@/hooks/useAuth";
import { teamApi } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { useState } from "react";

export function TeamJoinPage() {
  const { token } = useParams({ from: "/teams/join/$token" });
  const { isAuthenticated, loginWithSteam } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["team-invite", token],
    queryFn: async () => (await teamApi.invitePreview(token)).invite,
  });

  const joinMut = useMutation({
    mutationFn: () => teamApi.joinInvite(token),
    onSuccess: ({ team }) => {
      void navigate({ to: "/teams/$id", params: { id: team.id } });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Impossible de rejoindre"),
  });

  if (preview.isLoading) {
    return <p className="p-10 text-center text-pf-muted">Chargement de l&apos;invitation…</p>;
  }

  if (preview.isError || !preview.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Invitation invalide</h1>
        <p className="mt-2 text-pf-muted">Ce lien a expiré ou a été régénéré.</p>
      </div>
    );
  }

  const invite = preview.data;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-pf-line/80 bg-white/80 p-6 text-center">
        {invite.logoUrl ? (
          <img src={invite.logoUrl} alt="" className="mx-auto mb-4 h-20 w-20 rounded-xl object-cover" />
        ) : null}
        <h1 className="font-display text-3xl font-bold text-pf-ink">{invite.name}</h1>
        {invite.tag ? <p className="text-pf-muted">[{invite.tag}]</p> : null}
        <p className="mt-2 text-sm text-pf-muted">{invite.memberCount} membres</p>

        <ul className="mt-6 space-y-2 text-left">
          {invite.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 rounded-lg border border-pf-line/70 px-3 py-2">
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-pf-line/50" />
              )}
              <div>
                <p className="text-sm font-medium">{m.username}</p>
                <p className="font-mono text-[11px] text-pf-muted">{m.steamId64}</p>
              </div>
            </li>
          ))}
        </ul>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6">
          {!isAuthenticated ? (
            <Button variant="primary" onPress={loginWithSteam}>
              Connexion Steam pour rejoindre
            </Button>
          ) : (
            <Button variant="primary" isPending={joinMut.isPending} onPress={() => joinMut.mutate()}>
              Rejoindre l&apos;équipe
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
