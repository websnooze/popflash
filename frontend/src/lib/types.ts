export type User = {
  id: string;
  steamId64: string;
  username: string;
  avatarUrl: string | null;
  profileUrl: string | null;
};

export type LobbyTeam = "unassigned" | "team1" | "team2" | "spectator";

export type LobbyStatus =
  | "waiting"
  | "ready_check"
  | "map_veto"
  | "launching"
  | "in_match"
  | "closed";

export type MatchSettings = {
  connectTime: number;
  matchBeginCountdown: number;
  enableTechPause: boolean;
  waitForGotv: boolean;
  enablePlugin: boolean;
  voiceChat: "allies_only" | "all_players";
  knifeRound: boolean;
  maxRounds: 16 | 24 | 30 | 60;
  overtime: boolean;
  startMoney: number;
  maxMoney: number;
  overtimeMoney: number;
  armor: "default" | "kevlar" | "kevlar_helmet";
  headshotOnly: boolean;
  pauseCount: number;
  pauseDuration: number;
  freezeTime: number;
};

export type LobbyTemplateSettings = {
  teamSize: number;
  bestOf: number;
  location: string;
  locationSelectionMode: string;
  mapSelectionMode: string;
  startMode: string;
  privacy: string;
  allowJoinTeam: boolean;
  mapPool: string[];
  matchSettings: MatchSettings;
};

export type LobbyTemplate = {
  id: string;
  name: string;
  settings: LobbyTemplateSettings;
  createdAt: string;
  updatedAt: string;
};

export type VetoBan = {
  map: string;
  team: "team1" | "team2";
  byUserId: string;
  at: string;
};

export type VetoState = {
  status: "idle" | "in_progress" | "completed";
  remainingMaps: string[];
  bannedMaps: VetoBan[];
  turnTeam: "team1" | "team2" | null;
  selectedMap: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type ReadyCheckState = {
  active: boolean;
  endsAt: string | null;
};

export type LobbyPlayer = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  steamId64: string;
  team: LobbyTeam;
  isReady: boolean;
  isCaptain: boolean;
  isAdmin: boolean;
  joinedAt: string;
};

export type Lobby = {
  id: string;
  code: string;
  shareUrl: string;
  hostUserId: string;
  status: LobbyStatus;
  teamSize: number;
  bestOf: number;
  location: string;
  locationSelectionMode: string;
  map: string | null;
  mapPool: string[];
  mapSelectionMode: "host" | "captains_veto" | "players_vote" | string;
  startMode: "by_host" | "when_ready" | string;
  privacy: "public" | "password" | "private" | string;
  hasPassword: boolean;
  team1Name: string;
  team2Name: string;
  allowJoinTeam: boolean;
  matchSettings: MatchSettings;
  veto: VetoState;
  readyCheck: ReadyCheckState;
  isPublic: boolean;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  players: LobbyPlayer[];
  spectators: LobbyPlayer[];
  unassigned: LobbyPlayer[];
  team1: LobbyPlayer[];
  team2: LobbyPlayer[];
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  lobbyId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  channel: "general" | "team";
  team: "team1" | "team2" | null;
  message: string;
  createdAt: string;
};

export type MatchConnectInfo = {
  ip: string;
  port: number;
  password: string;
  connectString: string;
};

export type MatchView = {
  id: string;
  lobbyId: string;
  status: string;
  map: string;
  location: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  cancelReason: string | null;
  connect: MatchConnectInfo | null;
  createdAt: string;
};

export type LobbyAction =
  | { type: "set_settings"; settings: Record<string, unknown> }
  | { type: "set_team"; team: LobbyTeam }
  | { type: "set_player_team"; userId: string; team: LobbyTeam }
  | { type: "swap"; userIdA: string; userIdB: string }
  | { type: "set_captain"; userId: string; team: "team1" | "team2" }
  | { type: "clear_captain"; team: "team1" | "team2" }
  | { type: "scramble" }
  | { type: "set_ready"; isReady: boolean }
  | { type: "set_map"; map: string | null }
  | { type: "start_veto" }
  | { type: "cancel_veto" }
  | { type: "ban_map"; map: string }
  | { type: "chat"; message: string; channel?: "general" | "team" }
  | { type: "request_launch" }
  | { type: "leave" }
  | { type: "reset_settings" }
  | { type: "apply_template"; templateId: string };

export type TournamentFormat = "single_elim" | "double_elim" | "swiss" | "round_robin";

export type TeamMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: "captain" | "player" | "coach";
};

export type Team = {
  id: string;
  name: string;
  tag: string | null;
  logoUrl: string | null;
  captainUserId: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
};

export type TournamentEntry = {
  id: string;
  teamId: string;
  teamName: string;
  teamTag: string | null;
  logoUrl: string | null;
  seed: number | null;
  status: string;
  registeredAt: string;
};

export type TournamentFixture = {
  id: string;
  roundKey: string;
  bracketSide: string | null;
  position: number;
  team1EntryId: string | null;
  team2EntryId: string | null;
  team1Name: string | null;
  team2Name: string | null;
  score1: number;
  score2: number;
  bestOf: number;
  status: string;
  scheduledAt: string | null;
  lobbyId: string | null;
  lobbyCode: string | null;
  winnerEntryId: string | null;
  nextMatchId: string | null;
  nextSlot: number | null;
};

export type StandingRow = {
  entryId: string;
  wins: number;
  losses: number;
  draws: number;
  mapDiff: number;
  roundDiff: number;
  buchholz: number;
};

export type Tournament = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  status: string;
  format: TournamentFormat;
  teamSize: number;
  maxTeams: number;
  startsAt: string | null;
  entryCount: number;
  organizerUserId?: string;
  checkInRequired?: boolean;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  settings?: Record<string, unknown>;
  entries?: TournamentEntry[];
  fixtures?: TournamentFixture[];
  standings?: StandingRow[];
};

export type TournamentListItem = Pick<
  Tournament,
  "id" | "slug" | "title" | "description" | "imageUrl" | "status" | "format" | "teamSize" | "maxTeams" | "startsAt" | "entryCount"
>;
