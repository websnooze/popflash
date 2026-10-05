import { useState } from "react";
import { Button, Input, TextField } from "@heroui/react";
import { FieldSelect } from "@/components/lobby/advanced/SettingsFields";
import type { SettingsCategoryProps } from "@/components/lobby/advanced/types";
import {
  ACTIVE_DUTY_MAPS,
  BEST_OF_OPTIONS,
  MAP_SELECTION_MODES,
} from "@/lib/lobby-options";

export function MapsCategory({ lobby, isAdmin, patch }: SettingsCategoryProps) {
  const [workshopId, setWorkshopId] = useState("");

  function toggleMap(map: string) {
    const next = lobby.mapPool.includes(map)
      ? lobby.mapPool.filter((entry) => entry !== map)
      : [...lobby.mapPool, map];
    if (next.length === 0) return;
    patch({
      mapPool: next,
      map: lobby.map && next.includes(lobby.map) ? lobby.map : null,
    });
  }

  function addWorkshopMap() {
    const id = workshopId.trim();
    if (!/^\d+$/.test(id)) return;
    const map = `workshop/${id}`;
    if (lobby.mapPool.includes(map)) {
      setWorkshopId("");
      return;
    }
    patch({ mapPool: [...lobby.mapPool, map] });
    setWorkshopId("");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSelect
          label="Best of"
          isDisabled={!isAdmin}
          value={String(lobby.bestOf)}
          options={BEST_OF_OPTIONS.map((value) => ({
            id: String(value),
            label: `BO${value}`,
          }))}
          onChange={(value) => patch({ bestOf: Number(value) })}
        />
        <FieldSelect
          label="Map selection"
          isDisabled={!isAdmin}
          value={lobby.mapSelectionMode}
          options={[...MAP_SELECTION_MODES]}
          onChange={(value) => patch({ mapSelectionMode: value })}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Map pool</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIVE_DUTY_MAPS.map((map) => {
            const selected = lobby.mapPool.includes(map);
            return (
              <button
                key={map}
                type="button"
                disabled={!isAdmin}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-pf-accent bg-pf-accent/20 font-semibold"
                    : "border-pf-line bg-white/70"
                }`}
                onClick={() => toggleMap(map)}
              >
                {map}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Workshop maps</p>
        <div className="flex flex-wrap gap-2">
          {lobby.mapPool
            .filter((map) => map.startsWith("workshop/"))
            .map((map) => (
              <button
                key={map}
                type="button"
                disabled={!isAdmin}
                className="rounded-full border border-pf-line bg-white px-3 py-1 text-xs"
                onClick={() => toggleMap(map)}
              >
                {map} ×
              </button>
            ))}
        </div>
        {isAdmin ? (
          <div className="flex gap-2">
            <TextField className="flex-1" fullWidth>
              <Input
                value={workshopId}
                onChange={(event) => setWorkshopId(event.target.value)}
                placeholder="Workshop ID"
              />
            </TextField>
            <Button size="sm" variant="secondary" onPress={addWorkshopMap}>
              Add map
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
