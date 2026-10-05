import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { GameplayCategory } from "@/components/lobby/advanced/GameplayCategory";
import { LobbyCategory } from "@/components/lobby/advanced/LobbyCategory";
import { MainCategory } from "@/components/lobby/advanced/MainCategory";
import { MapsCategory } from "@/components/lobby/advanced/MapsCategory";
import { TemplatesCategory } from "@/components/lobby/advanced/TemplatesCategory";
import { TimeCategory } from "@/components/lobby/advanced/TimeCategory";
import {
  TOURNAMENT_SETTINGS_CATEGORIES,
  type CategoryId,
  type SettingsCategoryProps,
} from "@/components/lobby/advanced/types";
import { templateApi } from "@/lib/client";
import type { LobbyAction, TournamentSettings } from "@/lib/types";
import {
  applyLobbyPatchToTournamentDraft,
  defaultTournamentSettings,
  tournamentToLobbyView,
  type TournamentSettingsDraft,
} from "@/lib/tournament-settings";

type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  teamSize: number;
  settings: TournamentSettings;
  onSave: (draft: TournamentSettingsDraft) => void;
  isSaving?: boolean;
};

export function TournamentMatchSettingsModal({
  open,
  onClose,
  isAdmin,
  teamSize,
  settings,
  onSave,
  isSaving = false,
}: Props) {
  const [category, setCategory] = useState<CategoryId>("main");
  const [draft, setDraft] = useState<TournamentSettingsDraft>({ teamSize, settings });

  const templatesQuery = useQuery({
    queryKey: ["lobby-templates"],
    queryFn: () => templateApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setDraft({ teamSize, settings });
      setCategory("main");
    }
  }, [open, teamSize, settings]);

  function patch(partial: Record<string, unknown>) {
    if (!isAdmin) return;
    setDraft((prev) => applyLobbyPatchToTournamentDraft(prev, partial));
  }

  function patchMatch(partial: Record<string, unknown>) {
    patch({ matchSettings: partial });
  }

  function onAction(action: LobbyAction) {
    if (!isAdmin) return;
    if (action.type === "reset_settings") {
      setDraft({ teamSize: draft.teamSize, settings: defaultTournamentSettings() });
      return;
    }
    if (action.type === "apply_template") {
      const template = templatesQuery.data?.templates.find((t) => t.id === action.templateId);
      if (!template) return;
      setDraft({
        teamSize: template.settings.teamSize,
        settings: {
          bestOf: template.settings.bestOf as 1 | 3 | 5,
          location: template.settings.location,
          locationSelectionMode: template.settings
            .locationSelectionMode as TournamentSettings["locationSelectionMode"],
          mapSelectionMode: template.settings
            .mapSelectionMode as TournamentSettings["mapSelectionMode"],
          startMode: template.settings.startMode as TournamentSettings["startMode"],
          mapPool: template.settings.mapPool,
          matchSettings: template.settings.matchSettings,
        },
      });
    }
  }

  const lobby = tournamentToLobbyView(draft.teamSize, draft.settings);

  const categoryProps: SettingsCategoryProps = {
    lobby,
    isAdmin,
    onAction,
    patch,
    patchMatch,
    context: "tournament",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Paramètres des matchs"
      wide
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="pf-btn pf-btn-ghost" onClick={onClose}>
            Annuler
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="pf-btn pf-btn-primary"
              disabled={isSaving}
              onClick={() => onSave(draft)}
            >
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="flex min-h-112 flex-col gap-4 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto lg:w-44 lg:flex-col lg:overflow-visible">
          {TOURNAMENT_SETTINGS_CATEGORIES.map((entry) => (
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
              Lecture seule — seul l&apos;organisateur peut modifier ces paramètres.
            </p>
          ) : (
            <p className="text-sm text-pf-muted">
              Ces réglages seront appliqués à chaque lobby ouvert pour une rencontre du tournoi.
            </p>
          )}

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
