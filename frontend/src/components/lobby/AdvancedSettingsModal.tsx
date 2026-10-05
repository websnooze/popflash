import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { GameplayCategory } from "@/components/lobby/advanced/GameplayCategory";
import { LobbyCategory } from "@/components/lobby/advanced/LobbyCategory";
import { MainCategory } from "@/components/lobby/advanced/MainCategory";
import { MapsCategory } from "@/components/lobby/advanced/MapsCategory";
import { TemplatesCategory } from "@/components/lobby/advanced/TemplatesCategory";
import { TimeCategory } from "@/components/lobby/advanced/TimeCategory";
import {
  SETTINGS_CATEGORIES,
  type CategoryId,
  type SettingsCategoryProps,
} from "@/components/lobby/advanced/types";
import type { Lobby, LobbyAction, MatchSettings } from "@/lib/types";

type AdvancedSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  lobby: Lobby;
  isAdmin: boolean;
  onAction: (action: LobbyAction) => void;
};

export function AdvancedSettingsModal({
  open,
  onClose,
  lobby,
  isAdmin,
  onAction,
}: AdvancedSettingsModalProps) {
  const [category, setCategory] = useState<CategoryId>("main");

  function patch(settings: Record<string, unknown>) {
    if (!isAdmin) return;
    onAction({ type: "set_settings", settings });
  }

  function patchMatch(partial: Partial<MatchSettings>) {
    patch({ matchSettings: partial });
  }

  const categoryProps: SettingsCategoryProps = {
    lobby,
    isAdmin,
    onAction,
    patch,
    patchMatch,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Advanced settings"
      wide
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="pf-btn pf-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="flex min-h-112 flex-col gap-4 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto lg:w-44 lg:flex-col lg:overflow-visible">
          {SETTINGS_CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`pf-tab ${category === entry.id ? "pf-tab-active" : ""}`}
              onClick={() => setCategory(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {!isAdmin ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Lecture seule — seul l&apos;hôte peut modifier ces paramètres.
            </p>
          ) : null}

          {category === "main" ? <MainCategory {...categoryProps} /> : null}
          {category === "maps" ? <MapsCategory {...categoryProps} /> : null}
          {category === "lobby" ? <LobbyCategory {...categoryProps} /> : null}
          {category === "gameplay" ? <GameplayCategory {...categoryProps} /> : null}
          {category === "time" ? <TimeCategory {...categoryProps} /> : null}
          {category === "templates" ? <TemplatesCategory {...categoryProps} /> : null}
        </div>
      </div>
    </Modal>
  );
}
