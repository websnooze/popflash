import { useState } from "react";
import {
  LazyBoundary,
  LobbyChatPanels,
  LobbySettingsPanel,
  preloadLobbyChat,
  preloadLobbySettings,
} from "@/components/lobby/lazy";
import type { ChatMessage, Lobby, LobbyAction } from "@/lib/types";

type SideTab = "chat" | "settings";

type LobbySidePanelProps = {
  lobby: Lobby;
  isAdmin: boolean;
  meInLobby: boolean;
  myPlayingTeam: "team1" | "team2" | null;
  generalMessages: ChatMessage[];
  teamMessages: ChatMessage[];
  onAction: (action: LobbyAction) => void;
};

export function LobbySidePanel({
  lobby,
  isAdmin,
  meInLobby,
  myPlayingTeam,
  generalMessages,
  teamMessages,
  onAction,
}: LobbySidePanelProps) {
  const [sideTab, setSideTab] = useState<SideTab>("chat");

  return (
    <section className="flex min-h-128 flex-col overflow-hidden rounded-2xl border border-pf-line bg-white/90 shadow-sm">
      <div className="flex border-b border-pf-line p-2">
        <button
          type="button"
          className={`pf-tab flex-1 ${sideTab === "chat" ? "pf-tab-active" : ""}`}
          onClick={() => setSideTab("chat")}
          onMouseEnter={() => void preloadLobbyChat()}
          onFocus={() => void preloadLobbyChat()}
        >
          Chat
        </button>
        <button
          type="button"
          className={`pf-tab flex-1 ${sideTab === "settings" ? "pf-tab-active" : ""}`}
          onClick={() => setSideTab("settings")}
          onMouseEnter={() => void preloadLobbySettings()}
          onFocus={() => void preloadLobbySettings()}
        >
          Settings
        </button>
      </div>

      <div className="min-h-0 flex-1 p-3">
        {sideTab === "chat" ? (
          <LazyBoundary label="Loading chat…">
            <LobbyChatPanels
              generalMessages={generalMessages}
              teamMessages={teamMessages}
              generalDisabled={!meInLobby}
              teamDisabled={!myPlayingTeam}
              teamLabel={
                myPlayingTeam === "team1"
                  ? `${lobby.team1Name} chat`
                  : myPlayingTeam === "team2"
                    ? `${lobby.team2Name} chat`
                    : "Team chat"
              }
              teamHint={
                myPlayingTeam
                  ? "Only your teammates can see these messages."
                  : "Join a team to use team chat."
              }
              onSendGeneral={async (message) => {
                onAction({ type: "chat", message, channel: "general" });
              }}
              onSendTeam={async (message) => {
                onAction({ type: "chat", message, channel: "team" });
              }}
            />
          </LazyBoundary>
        ) : (
          <LazyBoundary label="Loading settings…">
            <LobbySettingsPanel lobby={lobby} isAdmin={isAdmin} onAction={onAction} compact />
          </LazyBoundary>
        )}
      </div>
    </section>
  );
}
