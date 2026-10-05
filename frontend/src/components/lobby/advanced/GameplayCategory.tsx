import { FieldSelect, FieldSlider, FieldSwitch } from "@/components/lobby/advanced/SettingsFields";
import type { SettingsCategoryProps } from "@/components/lobby/advanced/types";
import { ARMOR_OPTIONS, MAX_ROUNDS_OPTIONS } from "@/lib/lobby-options";
import type { MatchSettings } from "@/lib/types";

export function GameplayCategory({ lobby, isAdmin, patchMatch }: SettingsCategoryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldSwitch
        label="Knife round"
        isDisabled={!isAdmin}
        isSelected={lobby.matchSettings.knifeRound}
        onChange={(value) => patchMatch({ knifeRound: value })}
      />
      <FieldSelect
        label="Max rounds"
        isDisabled={!isAdmin}
        value={String(lobby.matchSettings.maxRounds)}
        options={MAX_ROUNDS_OPTIONS.map((value) => ({
          id: String(value),
          label: String(value),
        }))}
        onChange={(value) =>
          patchMatch({ maxRounds: Number(value) as MatchSettings["maxRounds"] })
        }
      />
      <FieldSwitch
        label="Overtime"
        isDisabled={!isAdmin}
        isSelected={lobby.matchSettings.overtime}
        onChange={(value) => patchMatch({ overtime: value })}
      />
      <FieldSelect
        label="Armor"
        isDisabled={!isAdmin}
        value={lobby.matchSettings.armor}
        options={[...ARMOR_OPTIONS]}
        onChange={(value) => patchMatch({ armor: value as MatchSettings["armor"] })}
      />
      <FieldSwitch
        label="Headshot only"
        isDisabled={!isAdmin}
        isSelected={lobby.matchSettings.headshotOnly}
        onChange={(value) => patchMatch({ headshotOnly: value })}
      />
      <FieldSlider
        label="Start money"
        unit="$"
        isDisabled={!isAdmin}
        min={800}
        max={16000}
        step={100}
        value={lobby.matchSettings.startMoney}
        onChange={(value) => patchMatch({ startMoney: value })}
      />
      <FieldSlider
        label="Max money"
        unit="$"
        isDisabled={!isAdmin}
        min={1}
        max={60000}
        step={100}
        value={lobby.matchSettings.maxMoney}
        onChange={(value) => patchMatch({ maxMoney: value })}
      />
      <FieldSlider
        label="Overtime money"
        unit="$"
        isDisabled={!isAdmin}
        min={0}
        max={16000}
        step={100}
        value={lobby.matchSettings.overtimeMoney}
        onChange={(value) => patchMatch({ overtimeMoney: value })}
      />
    </div>
  );
}
