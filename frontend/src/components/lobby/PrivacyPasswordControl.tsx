import { useEffect, useState } from "react";
import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";

type SelectOption = {
  id: string;
  label: string;
};

type PrivacyPasswordControlProps = {
  privacy: string;
  hasPassword: boolean;
  isAdmin: boolean;
  options: SelectOption[];
  onApply: (settings: { privacy: string; lobbyPassword?: string }) => void;
};

export function PrivacyPasswordControl({
  privacy,
  hasPassword,
  isAdmin,
  options,
  onApply,
}: PrivacyPasswordControlProps) {
  const [draftPrivacy, setDraftPrivacy] = useState(privacy);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const awaitingPassword = draftPrivacy === "password" && privacy !== "password";
  const showPasswordField = isAdmin && (draftPrivacy === "password" || privacy === "password");

  useEffect(() => {
    setDraftPrivacy(privacy);
    if (privacy === "password") {
      setPassword("");
      setPasswordError(null);
    }
  }, [privacy]);

  function handlePrivacyChange(next: string) {
    setPasswordError(null);
    setDraftPrivacy(next);

    if (next === "password") {
      if (privacy === "password" && hasPassword) {
        return;
      }
      setPassword("");
      return;
    }

    onApply({ privacy: next });
  }

  function submitPassword() {
    const trimmed = password.trim();
    if (trimmed.length < 4) {
      setPasswordError("Minimum 4 characters");
      return;
    }

    onApply({ privacy: "password", lobbyPassword: trimmed });
    setPassword("");
    setPasswordError(null);
  }

  return (
    <div className="space-y-3">
      <Select
        className="w-full"
        fullWidth
        isDisabled={!isAdmin}
        value={draftPrivacy}
        onChange={(key) => {
          if (key == null) return;
          handlePrivacyChange(String(key));
        }}
      >
        <Label>Lobby privacy</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((option) => (
              <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {showPasswordField ? (
        <div className="space-y-2">
          <TextField fullWidth>
            <Label>{awaitingPassword ? "Set lobby password" : "Lobby password"}</Label>
            <Input
              type="password"
              value={password}
              placeholder={
                hasPassword && !awaitingPassword ? "•••••••• (set)" : "Min. 4 characters"
              }
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitPassword();
              }}
            />
          </TextField>
          {passwordError ? <p className="text-xs text-red-600">{passwordError}</p> : null}
          {awaitingPassword ? (
            <p className="text-xs text-pf-muted">
              Enter a password to enable password protection.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" isDisabled={!password.trim()} onPress={submitPassword}>
              {awaitingPassword || !hasPassword ? "Save password" : "Change password"}
            </Button>
            {awaitingPassword ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setDraftPrivacy(privacy);
                  setPassword("");
                  setPasswordError(null);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
