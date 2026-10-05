import { useState } from "react";
import { Button, Input, TextField } from "@heroui/react";
import { lobbyApi } from "@/lib/client";
import { ApiError } from "@/lib/api";

type LobbyJoinGateProps = {
  isAuthenticated: boolean;
  meInLobby: boolean;
  hasPassword: boolean;
  lobbyCode: string;
  onLogin: () => void;
  onJoined: () => void;
  onError: (message: string) => void;
};

export function LobbyJoinGate({
  isAuthenticated,
  meInLobby,
  hasPassword,
  lobbyCode,
  onLogin,
  onJoined,
  onError,
}: LobbyJoinGateProps) {
  const [joinPassword, setJoinPassword] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="mb-4 rounded-2xl border border-pf-line bg-white/80 p-4">
        <Button variant="primary" onPress={onLogin}>
          Sign in with Steam
        </Button>
      </div>
    );
  }

  if (meInLobby) return null;

  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-pf-line bg-white/80 p-4">
      {hasPassword ? (
        <TextField fullWidth>
          <Input
            type="password"
            placeholder="Lobby password"
            value={joinPassword}
            onChange={(event) => setJoinPassword(event.target.value)}
          />
        </TextField>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onPress={() =>
            void lobbyApi
              .join(lobbyCode, { password: joinPassword || undefined })
              .then(onJoined)
              .catch((err) =>
                onError(err instanceof ApiError ? err.message : "Join failed"),
              )
          }
        >
          Join as player
        </Button>
        <Button
          variant="secondary"
          onPress={() =>
            void lobbyApi
              .join(lobbyCode, {
                asSpectator: true,
                password: joinPassword || undefined,
              })
              .then(onJoined)
              .catch((err) =>
                onError(err instanceof ApiError ? err.message : "Join failed"),
              )
          }
        >
          Join as spectator
        </Button>
      </div>
    </div>
  );
}
