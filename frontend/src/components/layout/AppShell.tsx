import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header";

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
