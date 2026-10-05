import { Suspense, lazy } from "react";
import { Spinner } from "@heroui/react";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

const HomePage = lazy(() =>
  import("@/routes/index").then((module) => ({ default: module.HomePage })),
);
const AuthSuccessPage = lazy(() =>
  import("@/routes/auth.success").then((module) => ({ default: module.AuthSuccessPage })),
);
const LobbyPage = lazy(() =>
  import("@/routes/lobby.$code").then((module) => ({ default: module.LobbyPage })),
);
const TournamentsPage = lazy(() =>
  import("@/routes/tournaments.index").then((module) => ({ default: module.TournamentsPage })),
);
const TournamentNewPage = lazy(() =>
  import("@/routes/tournaments.new").then((module) => ({ default: module.TournamentNewPage })),
);
const TournamentDetailPage = lazy(() =>
  import("@/routes/tournaments.$slug").then((module) => ({ default: module.TournamentDetailPage })),
);
const TeamsPage = lazy(() =>
  import("@/routes/teams.index").then((module) => ({ default: module.TeamsPage })),
);
const TeamDetailPage = lazy(() =>
  import("@/routes/teams.$id").then((module) => ({ default: module.TeamDetailPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function withSuspense(Component: React.ComponentType) {
  return function SuspendedRoute() {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Component />
      </Suspense>
    );
  };
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: withSuspense(HomePage),
});

const authSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/success",
  component: withSuspense(AuthSuccessPage),
});

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lobby/$code",
  component: withSuspense(LobbyPage),
});

const tournamentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tournaments",
  component: withSuspense(TournamentsPage),
});

const tournamentNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tournaments/new",
  component: withSuspense(TournamentNewPage),
});

const tournamentSlugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tournaments/$slug",
  component: withSuspense(TournamentDetailPage),
});

const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  component: withSuspense(TeamsPage),
});

const teamIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$id",
  component: withSuspense(TeamDetailPage),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authSuccessRoute,
  lobbyRoute,
  tournamentsRoute,
  tournamentNewRoute,
  tournamentSlugRoute,
  teamsRoute,
  teamIdRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
