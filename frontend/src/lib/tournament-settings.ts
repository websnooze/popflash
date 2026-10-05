import {
  ACTIVE_DUTY_MAPS,
  DEFAULT_MATCH_SETTINGS,
} from "@/lib/lobby-options";
import type { Lobby, MatchSettings, TournamentSettings } from "@/lib/types";

export function defaultTournamentSettings(): TournamentSettings {
  return {
    bestOf: 1,
    location: "stockholm",
    locationSelectionMode: "host",
    mapSelectionMode: "host",
    startMode: "by_host",
    mapPool: [...ACTIVE_DUTY_MAPS],
    matchSettings: { ...DEFAULT_MATCH_SETTINGS },
  };
}

export function normalizeTournamentSettings(
  settings?: Partial<TournamentSettings> | Record<string, unknown> | null,
): TournamentSettings {
  const base = defaultTournamentSettings();
  if (!settings) return base;

  const matchSettings = {
    ...base.matchSettings,
    ...((settings.matchSettings as Partial<MatchSettings> | undefined) ?? {}),
  };

  return {
    bestOf: (settings.bestOf as TournamentSettings["bestOf"]) ?? base.bestOf,
    location: (settings.location as string) ?? base.location,
    locationSelectionMode:
      (settings.locationSelectionMode as TournamentSettings["locationSelectionMode"]) ??
      base.locationSelectionMode,
    mapSelectionMode:
      (settings.mapSelectionMode as TournamentSettings["mapSelectionMode"]) ??
      base.mapSelectionMode,
    startMode: (settings.startMode as TournamentSettings["startMode"]) ?? base.startMode,
    mapPool: Array.isArray(settings.mapPool) && settings.mapPool.length
      ? (settings.mapPool as string[])
      : base.mapPool,
    matchSettings,
    roundRobinDouble:
      typeof settings.roundRobinDouble === "boolean"
        ? settings.roundRobinDouble
        : base.roundRobinDouble,
    swissRounds:
      typeof settings.swissRounds === "number" ? settings.swissRounds : base.swissRounds,
  };
}

/** Synthetic Lobby so we can reuse Advanced Settings categories. */
export function tournamentToLobbyView(
  teamSize: number,
  settings: TournamentSettings,
): Lobby {
  const now = new Date().toISOString();
  return {
    id: "tournament-settings",
    code: "TOURN",
    shareUrl: "",
    hostUserId: "",
    status: "waiting",
    teamSize,
    bestOf: settings.bestOf,
    location: settings.location,
    locationSelectionMode: settings.locationSelectionMode,
    map: null,
    mapPool: settings.mapPool,
    mapSelectionMode: settings.mapSelectionMode,
    startMode: settings.startMode,
    privacy: "private",
    hasPassword: false,
    team1Name: "Team A",
    team2Name: "Team B",
    allowJoinTeam: false,
    matchSettings: settings.matchSettings,
    veto: {
      status: "idle",
      remainingMaps: [],
      bannedMaps: [],
      turnTeam: null,
      selectedMap: null,
      startedAt: null,
      completedAt: null,
    },
    readyCheck: { active: false, endsAt: null },
    isPublic: false,
    playerCount: 0,
    spectatorCount: 0,
    maxPlayers: teamSize * 2,
    players: [],
    spectators: [],
    unassigned: [],
    team1: [],
    team2: [],
    createdAt: now,
    updatedAt: now,
  };
}

export type TournamentSettingsDraft = {
  teamSize: number;
  settings: TournamentSettings;
};

export function applyLobbyPatchToTournamentDraft(
  draft: TournamentSettingsDraft,
  patch: Record<string, unknown>,
): TournamentSettingsDraft {
  const next: TournamentSettingsDraft = {
    teamSize: draft.teamSize,
    settings: { ...draft.settings, matchSettings: { ...draft.settings.matchSettings } },
  };

  if (typeof patch.teamSize === "number") {
    next.teamSize = patch.teamSize;
  }
  if (typeof patch.bestOf === "number") {
    next.settings.bestOf = patch.bestOf as 1 | 3 | 5;
  }
  if (typeof patch.location === "string") {
    next.settings.location = patch.location;
  }
  if (typeof patch.locationSelectionMode === "string") {
    next.settings.locationSelectionMode =
      patch.locationSelectionMode as TournamentSettings["locationSelectionMode"];
  }
  if (typeof patch.mapSelectionMode === "string") {
    next.settings.mapSelectionMode =
      patch.mapSelectionMode as TournamentSettings["mapSelectionMode"];
  }
  if (typeof patch.startMode === "string") {
    next.settings.startMode = patch.startMode as TournamentSettings["startMode"];
  }
  if (Array.isArray(patch.mapPool)) {
    next.settings.mapPool = patch.mapPool as string[];
  }
  if (patch.matchSettings && typeof patch.matchSettings === "object") {
    next.settings.matchSettings = {
      ...next.settings.matchSettings,
      ...(patch.matchSettings as Partial<MatchSettings>),
    };
  }

  return next;
}
