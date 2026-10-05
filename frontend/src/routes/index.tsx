import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input, TextField, Label } from "@heroui/react";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";
import { lobbyApi } from "@/lib/client";
import { ApiError } from "@/lib/api";
import type { Lobby } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithSteam } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lobbiesQuery = useQuery({
    queryKey: ["lobbies"],
    queryFn: async () => {
      const { lobbies } = await lobbyApi.list();
      return lobbies;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      lobbyApi.create({
        teamSize: 5,
        location: "stockholm",
        bestOf: 1,
        mapSelectionMode: "host",
        startMode: "by_host",
        privacy: "public",
        allowJoinTeam: true,
      }),
    onSuccess: ({ lobby }) => {
      void navigate({ to: "/lobby/$code", params: { code: lobby.code } });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Could not create lobby",
      );
    },
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => lobbyApi.join(code),
    onSuccess: ({ lobby }) => {
      void navigate({ to: "/lobby/$code", params: { code: lobby.code } });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not join lobby");
    },
  });

  function requireAuth(action: () => void) {
    if (!isAuthenticated) {
      loginWithSteam();
      return;
    }
    action();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <section className="relative flex min-h-[78vh] flex-col justify-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-pf-muted">
            CS2 pickup matches
          </p>
          <div className="flex items-center gap-2">
            <Logo size={80} className="text-pf-default" />
            <h1 className="font-display max-w-4xl text-6xl font-bold leading-[0.92] tracking-tight text-pf-ink sm:text-7xl md:text-8xl">
              FRAG
              <span className="mx-1 inline-block bg-pf-accent px-2 text-pf-accent-ink">
                STACK
              </span>
            </h1>
          </div>
          <p className="mt-6 max-w-xl text-lg text-pf-muted sm:text-xl">
            Create a lobby, lock teams, run a captain map veto, and drop into a
            live DatHost CS2 server.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              variant="primary"
              isPending={createMutation.isPending}
              onPress={() => requireAuth(() => createMutation.mutate())}
            >
              Create lobby
            </Button>
            {!isAuthenticated ? (
              <Button size="lg" variant="secondary" onPress={loginWithSteam}>
                Sign in with Steam
              </Button>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="pointer-events-none absolute right-0 top-24 hidden h-72 w-72 rounded-full bg-pf-accent/25 blur-3xl md:block"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="pointer-events-none absolute bottom-10 right-10 hidden h-40 w-40 rounded-full bg-pf-team1/20 blur-2xl lg:block"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-3xl border border-pf-line bg-white/85 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold">
            Join with invite code
          </h2>
          <p className="mt-1 text-sm text-pf-muted">
            Paste a lobby code shared by your friends.
          </p>

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              requireAuth(() =>
                joinMutation.mutate(joinCode.trim().toUpperCase()),
              );
            }}
          >
            <TextField className="flex-1" fullWidth>
              <Label>Lobby code</Label>
              <Input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                placeholder="ABC123"
                maxLength={8}
              />
            </TextField>
            <Button
              className="sm:mt-6"
              type="submit"
              variant="secondary"
              isPending={joinMutation.isPending}
              isDisabled={joinCode.trim().length < 4}
            >
              Join
            </Button>
          </form>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="rounded-3xl border border-pf-line bg-white/85 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold">Open lobbies</h2>
          <p className="mt-1 text-sm text-pf-muted">
            Public rooms waiting for players.
          </p>

          <div className="mt-5 space-y-2">
            {lobbiesQuery.isLoading ? (
              <p className="text-sm text-pf-muted">Loading…</p>
            ) : lobbiesQuery.data && lobbiesQuery.data.length > 0 ? (
              lobbiesQuery.data.slice(0, 6).map((lobby) => (
                <LobbyRow
                  key={lobby.id}
                  lobby={lobby}
                  onOpen={() =>
                    void navigate({
                      to: "/lobby/$code",
                      params: { code: lobby.code },
                    })
                  }
                />
              ))
            ) : (
              <p className="text-sm text-pf-muted">
                No public lobbies yet. Create the first one.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function LobbyRow({ lobby, onOpen }: { lobby: Lobby; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-xl border border-pf-line bg-white px-4 py-3 text-left transition hover:border-pf-ink/30 hover:bg-pf-accent/10"
    >
      <div>
        <p className="font-semibold text-pf-ink">#{lobby.code}</p>
        <p className="text-xs text-pf-muted">
          {lobby.playerCount}/{lobby.maxPlayers} · {lobby.location} ·{" "}
          {lobby.status}
        </p>
      </div>
      <span className="text-sm font-medium text-pf-ink">Open</span>
    </button>
  );
}
