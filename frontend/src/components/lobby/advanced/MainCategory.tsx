import { PrivacyPasswordControl } from "@/components/lobby/PrivacyPasswordControl";
import { FieldSelect, FieldSwitch } from "@/components/lobby/advanced/SettingsFields";
import {
  DATHOST_LOCATIONS,
  GAME_MODES,
  LOCATION_SELECTION_MODES,
  PRIVACY_MODES,
  START_MODES,
} from "@/lib/lobby-options";
import type { SettingsCategoryProps } from "@/components/lobby/advanced/types";

export function MainCategory({ lobby, isAdmin, patch, patchMatch }: SettingsCategoryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldSelect
        label="Mode"
        isDisabled={!isAdmin}
        value={String(lobby.teamSize)}
        options={GAME_MODES.map((mode) => ({
          id: String(mode.teamSize),
          label: mode.label,
        }))}
        onChange={(value) => patch({ teamSize: Number(value) })}
      />
      <FieldSelect
        label="Location"
        isDisabled={!isAdmin}
        value={lobby.location}
        options={DATHOST_LOCATIONS.map((location) => ({
          id: location.id,
          label: location.label,
        }))}
        onChange={(value) => patch({ location: value })}
      />
      <FieldSelect
        label="Location choice"
        isDisabled={!isAdmin}
        value={lobby.locationSelectionMode}
        options={[...LOCATION_SELECTION_MODES]}
        onChange={(value) => patch({ locationSelectionMode: value })}
      />
      <FieldSelect
        label="Starting the match"
        isDisabled={!isAdmin}
        value={lobby.startMode}
        options={[...START_MODES]}
        onChange={(value) => patch({ startMode: value })}
      />
      <div className="sm:col-span-2">
        <PrivacyPasswordControl
          privacy={lobby.privacy}
          hasPassword={lobby.hasPassword}
          isAdmin={isAdmin}
          options={[...PRIVACY_MODES]}
          onApply={(settings) => patch(settings)}
        />
      </div>
      <FieldSwitch
        label="GOTV"
        description="Wait for GOTV before ending the match"
        isDisabled={!isAdmin}
        isSelected={lobby.matchSettings.waitForGotv}
        onChange={(value) => patchMatch({ waitForGotv: value })}
      />
    </div>
  );
}
