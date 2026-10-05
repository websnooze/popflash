import { FieldSelect, FieldSwitch } from "@/components/lobby/advanced/SettingsFields";
import type { SettingsCategoryProps } from "@/components/lobby/advanced/types";
import { VOICE_CHAT_OPTIONS } from "@/lib/lobby-options";
import type { MatchSettings } from "@/lib/types";

export function LobbyCategory({
  lobby,
  isAdmin,
  patch,
  patchMatch,
  context = "lobby",
}: SettingsCategoryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {context === "lobby" ? (
        <FieldSwitch
          label="Allow joining the team"
          description="Players can move between sides"
          isDisabled={!isAdmin}
          isSelected={lobby.allowJoinTeam}
          onChange={(value) => patch({ allowJoinTeam: value })}
        />
      ) : (
        <p className="sm:col-span-2 text-sm text-pf-muted">
          Les lobbies de match tournoi sont privés et pré-remplis avec les rosters.
        </p>
      )}
      <FieldSelect
        label="Voice chat"
        isDisabled={!isAdmin}
        value={lobby.matchSettings.voiceChat}
        options={[...VOICE_CHAT_OPTIONS]}
        onChange={(value) =>
          patchMatch({ voiceChat: value as MatchSettings["voiceChat"] })
        }
      />
    </div>
  );
}
