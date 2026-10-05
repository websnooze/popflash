import { DATHOST_LOCATIONS } from "@/lib/lobby-options";
import type { Lobby } from "@/lib/types";

export function buildSettingsRecap(lobby: Lobby): string {
  const location =
    DATHOST_LOCATIONS.find((entry) => entry.id === lobby.location)?.label ?? lobby.location;

  return [
    `Mode: ${lobby.teamSize}v${lobby.teamSize}`,
    `Location: ${location}`,
    `Location choice: ${lobby.locationSelectionMode}`,
    `Start: ${lobby.startMode}`,
    `Lobby: ${lobby.privacy}`,
    `GOTV: ${lobby.matchSettings.waitForGotv ? "on" : "off"}`,
    `Best of: ${lobby.bestOf}`,
    `Map selection: ${lobby.mapSelectionMode}`,
    `Maps: ${lobby.mapPool.join(", ")}`,
    `Join teams: ${lobby.allowJoinTeam ? "yes" : "no"}`,
    `Voice: ${lobby.matchSettings.voiceChat}`,
    `Knife: ${lobby.matchSettings.knifeRound ? "on" : "off"}`,
    `Max rounds: ${lobby.matchSettings.maxRounds}`,
    `Overtime: ${lobby.matchSettings.overtime ? "on" : "off"}`,
    `Start money: $${lobby.matchSettings.startMoney}`,
    `Max money: $${lobby.matchSettings.maxMoney}`,
    `OT money: $${lobby.matchSettings.overtimeMoney}`,
    `Armor: ${lobby.matchSettings.armor}`,
    `HS only: ${lobby.matchSettings.headshotOnly ? "on" : "off"}`,
    `Pauses: ${lobby.matchSettings.pauseCount} × ${lobby.matchSettings.pauseDuration}s`,
    `Freezetime: ${lobby.matchSettings.freezeTime}s`,
  ].join("\n");
}
