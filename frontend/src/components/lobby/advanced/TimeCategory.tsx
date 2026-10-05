import { FieldSlider } from "@/components/lobby/advanced/SettingsFields";
import type { SettingsCategoryProps } from "@/components/lobby/advanced/types";

export function TimeCategory({ lobby, isAdmin, patchMatch }: SettingsCategoryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldSlider
        label="Number of pauses"
        isDisabled={!isAdmin}
        min={0}
        max={6}
        step={1}
        value={lobby.matchSettings.pauseCount}
        onChange={(value) => patchMatch({ pauseCount: value })}
      />
      <FieldSlider
        label="Pause duration"
        unit="sec"
        isDisabled={!isAdmin}
        min={1}
        max={90}
        step={1}
        value={lobby.matchSettings.pauseDuration}
        onChange={(value) => patchMatch({ pauseDuration: value })}
      />
      <FieldSlider
        label="Freezetime"
        unit="sec"
        isDisabled={!isAdmin}
        min={0}
        max={30}
        step={1}
        value={lobby.matchSettings.freezeTime}
        onChange={(value) => patchMatch({ freezeTime: value })}
      />
    </div>
  );
}
