import { Suspense, lazy, useState } from "react";
import { Button, Description, Label, Switch } from "@heroui/react";
import { PrivacyPasswordControl } from "@/components/lobby/PrivacyPasswordControl";
import { ChunkFallback } from "@/components/lobby/ChunkFallback";
import { FieldSelect } from "@/components/lobby/advanced/SettingsFields";
import {
  BEST_OF_OPTIONS,
  DATHOST_LOCATIONS,
  GAME_MODES,
  MAP_SELECTION_MODES,
  PRIVACY_MODES,
  START_MODES,
} from "@/lib/lobby-options";
import type { Lobby, LobbyAction } from "@/lib/types";

const AdvancedSettingsModal = lazy(() =>
  import("@/components/lobby/AdvancedSettingsModal").then((module) => ({
    default: module.AdvancedSettingsModal,
  })),
);

type LobbySettingsPanelProps = {
  lobby: Lobby;
  isAdmin: boolean;
  onAction: (action: LobbyAction) => void;
  compact?: boolean;
};

function preloadAdvancedSettings() {
  return Promise.all([
    import("@/components/lobby/AdvancedSettingsModal"),
    import("@/components/ui/Modal"),
  ]);
}

export function LobbySettingsPanel({
  lobby,
  isAdmin,
  onAction,
  compact = false,
}: LobbySettingsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function patch(settings: Record<string, unknown>) {
    if (!isAdmin) return;
    onAction({ type: "set_settings", settings });
  }

  return (
    <>
      <div
        className={`flex h-full flex-col gap-4 ${compact ? "" : "rounded-2xl border border-pf-line bg-white/90 p-4 shadow-sm"}`}
      >
        {!compact ? (
          <div>
            <h2 className="font-display text-xl font-bold">Match settings</h2>
            <p className="text-xs text-pf-muted">
              {isAdmin ? "Synced live over WebSocket" : "Only the host can edit these"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-pf-muted">
            {isAdmin ? "Synced live over WebSocket" : "Only the host can edit these"}
          </p>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <FieldSelect
            label="Series"
            isDisabled={!isAdmin}
            value={String(lobby.bestOf)}
            options={BEST_OF_OPTIONS.map((value) => ({
              id: String(value),
              label: `BO${value}`,
            }))}
            onChange={(value) => patch({ bestOf: Number(value) })}
          />
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
            label="Map selection"
            isDisabled={!isAdmin}
            value={lobby.mapSelectionMode}
            options={[...MAP_SELECTION_MODES]}
            onChange={(value) => patch({ mapSelectionMode: value })}
          />
          <FieldSelect
            label="Server location"
            isDisabled={!isAdmin}
            value={lobby.location}
            options={DATHOST_LOCATIONS.map((location) => ({
              id: location.id,
              label: location.label,
            }))}
            onChange={(value) => patch({ location: value })}
          />
          <FieldSelect
            label="Who starts the match"
            isDisabled={!isAdmin}
            value={lobby.startMode}
            options={[...START_MODES]}
            onChange={(value) => patch({ startMode: value })}
          />

          <Switch
            isSelected={lobby.allowJoinTeam}
            isDisabled={!isAdmin}
            onChange={(isSelected) => patch({ allowJoinTeam: isSelected })}
          >
            <Switch.Content>
              <div className="flex flex-col gap-0.5">
                <Label>Allow joining the team</Label>
                <Description>Players can move between sides</Description>
              </div>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>

          <PrivacyPasswordControl
            privacy={lobby.privacy}
            hasPassword={lobby.hasPassword}
            isAdmin={isAdmin}
            options={[...PRIVACY_MODES]}
            onApply={(settings) => patch(settings)}
          />
        </div>

        <Button
          variant="secondary"
          fullWidth
          onHoverStart={() => void preloadAdvancedSettings()}
          onPress={() => {
            void preloadAdvancedSettings();
            setAdvancedOpen(true);
          }}
        >
          Advanced settings
        </Button>
      </div>

      {advancedOpen ? (
        <Suspense fallback={<ChunkFallback label="Loading advanced settings…" />}>
          <AdvancedSettingsModal
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            lobby={lobby}
            isAdmin={isAdmin}
            onAction={onAction}
          />
        </Suspense>
      ) : null}
    </>
  );
}
