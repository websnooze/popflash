import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button, Spinner } from "@heroui/react";
import { useAuth } from "@/hooks/useAuth";
import { useLobbySocket } from "@/hooks/useLobbySocket";
import { lobbyApi, matchApi } from "@/lib/client";
import type { ChatMessage, LobbyAction } from "@/lib/types";
import { LobbyJoinGate } from "@/components/lobby/LobbyJoinGate";
import { LobbySidePanel } from "@/components/lobby/LobbySidePanel";
import {
  LazyBoundary,
  LobbyPageHero,
  LobbyPlayGrid,
  LobbyToolbar,
  preloadLobbyPlayGrid,
} from "@/components/lobby/lazy";

export function LobbyPage() {
  const { code } = useParams({ from: "/lobby/$code" });
  const navigate = useNavigate();
  const { user, isAuthenticated, loginWithSteam } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  const lobbyQuery = useQuery({
    queryKey: ["lobby", code.toUpperCase()],
    queryFn: async () => {
      const { lobby } = await lobbyApi.getByCode(code);
      return lobby;
    },
  });

  const lobby = lobbyQuery.data;
  const { sendAction, lastError, connected } = useLobbySocket(lobby?.id);

  useEffect(() => {
    if (lobby?.id) void preloadLobbyPlayGrid();
  }, [lobby?.id]);

  const myTeam = lobby?.players.find((player) => player.userId === user?.id)?.team;
  const myPlayingTeam = myTeam === "team1" || myTeam === "team2" ? myTeam : null;

  const chatQuery = useQuery({
    queryKey: ["lobby-chat", lobby?.id, myPlayingTeam],
    enabled: Boolean(lobby?.id),
    queryFn: async () => {
      const { messages } = await lobbyApi.chatHistory(lobby!.id);
      return messages;
    },
  });

  const matchQuery = useQuery({
    queryKey: ["match", lobby?.id],
    enabled: Boolean(lobby?.id),
    queryFn: async () => {
      const { match } = await matchApi.latest(lobby!.id);
      return match;
    },
    refetchInterval:
      lobby?.status === "launching" || lobby?.status === "in_match" ? 4000 : false,
  });

  const messages = useMemo(
    () => chatQuery.data ?? ([] as ChatMessage[]),
    [chatQuery.data],
  );
  const generalMessages = useMemo(
    () => messages.filter((message) => message.channel !== "team"),
    [messages],
  );
  const teamMessages = useMemo(
    () => messages.filter((message) => message.channel === "team"),
    [messages],
  );
  const error = localError ?? lastError;

  function act(action: LobbyAction) {
    setLocalError(null);
    sendAction(action);
  }

  if (lobbyQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (lobbyQuery.isError || !lobby) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Lobby not found</h1>
        <Button className="mt-6" onPress={() => void navigate({ to: "/" })}>
          Back home
        </Button>
      </div>
    );
  }

  const meInLobby = lobby.players.some((player) => player.userId === user?.id);
  const isAdmin = user?.id === lobby.hostUserId;

  return (
    <div className="mx-auto max-w-350 px-4 py-6 sm:px-6">
      <LazyBoundary label="Loading header…">
        <LobbyPageHero
          code={lobby.code}
          connected={connected}
          team1Name={lobby.team1Name}
          team2Name={lobby.team2Name}
          bestOf={lobby.bestOf}
          teamSize={lobby.teamSize}
          location={lobby.location}
        />
      </LazyBoundary>

      <LobbyJoinGate
        isAuthenticated={isAuthenticated}
        meInLobby={meInLobby}
        hasPassword={lobby.hasPassword}
        lobbyCode={lobby.code}
        onLogin={loginWithSteam}
        onJoined={() => void lobbyQuery.refetch()}
        onError={setLocalError}
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4">
        <LazyBoundary label="Loading toolbar…">
          <LobbyToolbar
            lobby={lobby}
            currentUser={user}
            match={matchQuery.data ?? null}
            onCopyLink={() => void navigator.clipboard.writeText(window.location.href)}
            onReady={() => {
              const me = lobby.players.find((player) => player.userId === user?.id);
              if (!me) return;
              act({ type: "set_ready", isReady: !me.isReady });
            }}
            onScramble={() => act({ type: "scramble" })}
            onLaunch={() => act({ type: "request_launch" })}
          />
        </LazyBoundary>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <LobbySidePanel
          lobby={lobby}
          isAdmin={isAdmin}
          meInLobby={meInLobby}
          myPlayingTeam={myPlayingTeam}
          generalMessages={generalMessages}
          teamMessages={teamMessages}
          onAction={act}
        />

        <LazyBoundary label="Loading teams…">
          <LobbyPlayGrid
            lobby={lobby}
            currentUser={user}
            meInLobby={meInLobby}
            onAction={act}
          />
        </LazyBoundary>
      </div>
    </div>
  );
}
