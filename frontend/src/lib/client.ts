import { api, API_URL } from "./api";
import type {
  ChatMessage,
  Lobby,
  LobbyTemplate,
  LobbyTemplateSettings,
  MatchView,
  Team,
  Tournament,
  TournamentListItem,
  User,
} from "./types";

export const authApi = {
  me: () => api<{ user: User }>("/auth/me"),
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  steamLoginUrl: () => `${API_URL}/auth/steam`,
};

export const lobbyApi = {
  list: () => api<{ lobbies: Lobby[] }>("/lobbies"),
  get: (lobbyId: string) => api<{ lobby: Lobby }>(`/lobbies/${lobbyId}`),
  getByCode: (code: string) => api<{ lobby: Lobby }>(`/lobbies/code/${code}`),
  create: (body: Record<string, unknown> = {}) =>
    api<{ lobby: Lobby }>("/lobbies", { method: "POST", body: JSON.stringify(body) }),
  join: (code: string, options: { asSpectator?: boolean; password?: string } = {}) =>
    api<{ lobby: Lobby }>("/lobbies/join", {
      method: "POST",
      body: JSON.stringify({
        code,
        asSpectator: options.asSpectator ?? false,
        password: options.password,
      }),
    }),
  chatHistory: (lobbyId: string) =>
    api<{ messages: ChatMessage[] }>(`/lobbies/${lobbyId}/chat`),
};

export const templateApi = {
  list: () => api<{ templates: LobbyTemplate[] }>("/templates"),
  save: (body: { name: string; settings: LobbyTemplateSettings }) =>
    api<{ template: LobbyTemplate }>("/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (templateId: string) =>
    api<{ ok: boolean }>(`/templates/${templateId}`, { method: "DELETE" }),
};

export const matchApi = {
  latest: (lobbyId: string) =>
    api<{ match: MatchView | null }>(`/matches/lobby/${lobbyId}/latest`),
};

export const teamApi = {
  list: (mine = false) => api<{ teams: Team[] }>(`/teams${mine ? "?mine=1" : ""}`),
  get: (teamId: string) => api<{ team: Team }>(`/teams/${teamId}`),
  create: (body: { name: string; tag?: string; logoUrl?: string }) =>
    api<{ team: Team }>("/teams", { method: "POST", body: JSON.stringify(body) }),
  update: (teamId: string, body: Record<string, unknown>) =>
    api<{ team: Team }>(`/teams/${teamId}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (teamId: string) =>
    api<{ ok: boolean }>(`/teams/${teamId}`, { method: "DELETE" }),
  leave: (teamId: string) =>
    api<{ ok: boolean } | { team: Team }>(`/teams/${teamId}/leave`, { method: "POST" }),
  regenerateInvite: (teamId: string) =>
    api<{ team: Team }>(`/teams/${teamId}/invite/regenerate`, { method: "POST" }),
  invitePreview: (token: string) =>
    api<{
      invite: {
        teamId: string;
        name: string;
        tag: string | null;
        logoUrl: string | null;
        memberCount: number;
        members: Team["members"];
      };
    }>(`/teams/invite/${token}`),
  joinInvite: (token: string) =>
    api<{ team: Team }>(`/teams/join/${token}`, { method: "POST" }),
  addMember: (teamId: string, body: { userId: string; role?: string }) =>
    api<{ team: Team }>(`/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMemberRole: (teamId: string, userId: string, role: string) =>
    api<{ team: Team }>(`/teams/${teamId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (teamId: string, userId: string) =>
    api<{ team: Team }>(`/teams/${teamId}/members/${userId}`, { method: "DELETE" }),
};

export const tournamentApi = {
  list: () => api<{ tournaments: TournamentListItem[] }>("/tournaments"),
  getBySlug: (slug: string) => api<{ tournament: Tournament }>(`/tournaments/slug/${slug}`),
  create: (body: Record<string, unknown>) =>
    api<{ tournament: Tournament }>("/tournaments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  publish: (id: string) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/publish`, { method: "POST" }),
  register: (id: string, teamId: string) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/entries`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
    }),
  generateBracket: (id: string, randomSeed = false) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/generate-bracket`, {
      method: "POST",
      body: JSON.stringify({ randomSeed }),
    }),
  patchFixture: (
    id: string,
    matchId: string,
    body: { scheduledAt?: string | null; score1?: number; score2?: number; status?: string },
  ) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  openLobby: (id: string, matchId: string) =>
    api<{ tournament: Tournament; lobby: Lobby }>(
      `/tournaments/${id}/matches/${matchId}/open-lobby`,
      { method: "POST" },
    ),
  checkIn: (id: string, entryId: string) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/check-in`, {
      method: "POST",
      body: JSON.stringify({ entryId }),
    }),
  withdraw: (id: string, entryId: string) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/entries/${entryId}/withdraw`, {
      method: "POST",
    }),
  cancel: (id: string) =>
    api<{ tournament: Tournament }>(`/tournaments/${id}/cancel`, { method: "POST" }),
};
