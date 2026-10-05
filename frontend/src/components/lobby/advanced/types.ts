import type { Lobby, LobbyAction, MatchSettings } from "@/lib/types";

export type SettingsContext = "lobby" | "tournament";

export type SettingsCategoryProps = {
  lobby: Lobby;
  isAdmin: boolean;
  onAction: (action: LobbyAction) => void;
  patch: (settings: Record<string, unknown>) => void;
  patchMatch: (partial: Partial<MatchSettings>) => void;
  context?: SettingsContext;
};

export type CategoryId = "main" | "maps" | "lobby" | "gameplay" | "time" | "templates";

export const SETTINGS_CATEGORIES: Array<{ id: CategoryId; label: string }> = [
  { id: "main", label: "Main" },
  { id: "maps", label: "Maps" },
  { id: "lobby", label: "Lobby" },
  { id: "gameplay", label: "Gameplay" },
  { id: "time", label: "Time and pauses" },
  { id: "templates", label: "Templates" },
];

export const TOURNAMENT_SETTINGS_CATEGORIES = SETTINGS_CATEGORIES;
