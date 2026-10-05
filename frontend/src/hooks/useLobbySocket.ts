import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_URL } from "@/lib/api";
import type { ChatMessage, Lobby, LobbyAction, MatchView } from "@/lib/types";

type ServerMessage =
  | { type: "pong" }
  | { type: "subscribed"; lobbyId: string }
  | { type: "error"; message: string }
  | { type: "lobby_updated"; lobbyId: string; payload: Lobby }
  | { type: "chat_message"; lobbyId: string; payload: ChatMessage }
  | { type: "match_updated"; lobbyId: string; matchId: string; payload: MatchView }
  | { type: "match_connect"; lobbyId: string; matchId: string; connect: unknown }
  | { type: "action_ok"; actionType: string };

export function useLobbySocket(lobbyId: string | undefined) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "subscribe", lobbyId }));
    });

    socket.addEventListener("close", () => setConnected(false));

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;

        if (message.type === "error") {
          setLastError(message.message);
          return;
        }

        if (message.type === "lobby_updated") {
          queryClient.setQueryData(["lobby", message.payload.code], message.payload);
          queryClient.setQueryData(["lobby", message.lobbyId], message.payload);
          queryClient.setQueryData(["lobby", lobbyId], message.payload);
        }

        if (message.type === "chat_message") {
          queryClient.setQueriesData<ChatMessage[]>(
            { queryKey: ["lobby-chat", lobbyId] },
            (prev) => {
              const current = prev ?? [];
              if (current.some((item) => item.id === message.payload.id)) return current;
              return [...current, message.payload];
            },
          );
        }

        if (message.type === "match_updated" || message.type === "match_connect") {
          void queryClient.invalidateQueries({ queryKey: ["match", lobbyId] });
        }
      } catch {
        // ignore
      }
    });

    const ping = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);

    return () => {
      window.clearInterval(ping);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "unsubscribe", lobbyId }));
      }
      socket.close();
      socketRef.current = null;
    };
  }, [lobbyId, queryClient]);

  const sendAction = useCallback(
    (action: LobbyAction) => {
      const socket = socketRef.current;
      if (!lobbyId || !socket || socket.readyState !== WebSocket.OPEN) {
        setLastError("WebSocket is not connected");
        return;
      }
      setLastError(null);
      socket.send(JSON.stringify({ type: "lobby_action", lobbyId, action }));
    },
    [lobbyId],
  );

  return { connected, sendAction, lastError, clearError: () => setLastError(null) };
}
