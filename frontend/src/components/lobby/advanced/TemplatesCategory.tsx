import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, TextField } from "@heroui/react";
import { buildSettingsRecap } from "@/components/lobby/advanced/settings-recap";
import type { SettingsCategoryProps } from "@/components/lobby/advanced/types";
import { templateApi } from "@/lib/client";

export function TemplatesCategory({
  lobby,
  isAdmin,
  onAction,
}: SettingsCategoryProps) {
  const [templateName, setTemplateName] = useState("");
  const queryClient = useQueryClient();
  const templateRecap = useMemo(() => buildSettingsRecap(lobby), [lobby]);

  const templatesQuery = useQuery({
    queryKey: ["lobby-templates"],
    queryFn: () => templateApi.list(),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: templateApi.save,
    onSuccess: async () => {
      setTemplateName("");
      await queryClient.invalidateQueries({ queryKey: ["lobby-templates"] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: templateApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lobby-templates"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-pf-line bg-white/70 p-4">
        <p className="mb-2 text-sm font-semibold">Current settings</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-pf-muted">
          {templateRecap}
        </pre>
        {isAdmin ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <TextField className="min-w-48 flex-1" fullWidth>
              <Label>Template name</Label>
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="My competitive preset"
              />
            </TextField>
            <Button
              className="self-end"
              variant="primary"
              isPending={saveTemplateMutation.isPending}
              isDisabled={!templateName.trim()}
              onPress={() =>
                saveTemplateMutation.mutate({
                  name: templateName.trim(),
                  settings: {
                    teamSize: lobby.teamSize,
                    bestOf: lobby.bestOf,
                    location: lobby.location,
                    locationSelectionMode: lobby.locationSelectionMode,
                    mapSelectionMode: lobby.mapSelectionMode,
                    startMode: lobby.startMode,
                    privacy: lobby.privacy,
                    allowJoinTeam: lobby.allowJoinTeam,
                    mapPool: lobby.mapPool,
                    matchSettings: lobby.matchSettings,
                  },
                })
              }
            >
              Save template
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Saved templates</p>
        {(templatesQuery.data?.templates ?? []).length === 0 ? (
          <p className="text-sm text-pf-muted">No templates yet.</p>
        ) : (
          (templatesQuery.data?.templates ?? []).map((template) => (
            <div
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-pf-line bg-white/80 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-xs text-pf-muted">
                  {template.settings.teamSize}v{template.settings.teamSize} · BO
                  {template.settings.bestOf} · {template.settings.location}
                </p>
              </div>
              {isAdmin ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      onAction({ type: "apply_template", templateId: template.id })
                    }
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    isPending={deleteTemplateMutation.isPending}
                    onPress={() => deleteTemplateMutation.mutate(template.id)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {isAdmin ? (
        <Button variant="secondary" onPress={() => onAction({ type: "reset_settings" })}>
          Reset to defaults
        </Button>
      ) : null}
    </div>
  );
}
