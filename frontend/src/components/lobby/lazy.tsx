import { lazy } from "react";
import { LazyBoundary, ChunkFallback } from "@/components/lobby/ChunkFallback";

export { LazyBoundary, ChunkFallback };

export const LobbyChatPanels = lazy(() =>
  import("@/components/lobby/LobbyChat").then((module) => ({
    default: module.LobbyChatPanels,
  })),
);

export const LobbySettingsPanel = lazy(() =>
  import("@/components/lobby/LobbySettingsPanel").then((module) => ({
    default: module.LobbySettingsPanel,
  })),
);

export const LobbyToolbar = lazy(() =>
  import("@/components/lobby/LobbyToolbar").then((module) => ({
    default: module.LobbyToolbar,
  })),
);

export const LobbyPlayGrid = lazy(() =>
  import("@/components/lobby/LobbyPlayGrid").then((module) => ({
    default: module.LobbyPlayGrid,
  })),
);

export const LobbyPageHero = lazy(() =>
  import("@/components/lobby/LobbyPageHero").then((module) => ({
    default: module.LobbyPageHero,
  })),
);

export const AdvancedSettingsModal = lazy(() =>
  import("@/components/lobby/AdvancedSettingsModal").then((module) => ({
    default: module.AdvancedSettingsModal,
  })),
);

export const PrivacyPasswordControl = lazy(() =>
  import("@/components/lobby/PrivacyPasswordControl").then((module) => ({
    default: module.PrivacyPasswordControl,
  })),
);

export const Modal = lazy(() =>
  import("@/components/ui/Modal").then((module) => ({
    default: module.Modal,
  })),
);

export function preloadLobbyChat() {
  return import("@/components/lobby/LobbyChat");
}

export function preloadLobbySettings() {
  return import("@/components/lobby/LobbySettingsPanel");
}

export function preloadLobbyPlayGrid() {
  return Promise.all([
    import("@/components/lobby/LobbyPlayGrid"),
    import("@/components/lobby/LobbyToolbar"),
    import("@/components/lobby/MapVetoPanel"),
    import("@/components/lobby/TeamPanel"),
  ]);
}

export function preloadLobbyToolbar() {
  return import("@/components/lobby/LobbyToolbar");
}

export function preloadAdvancedSettings() {
  return Promise.all([
    import("@/components/lobby/AdvancedSettingsModal"),
    import("@/components/ui/Modal"),
    import("@/lib/lobby-options"),
  ]);
}
