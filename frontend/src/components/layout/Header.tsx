import { Avatar, Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "../ui/Logo";

export function Header() {
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithSteam,
    logout,
    isLoggingOut,
  } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-pf-line/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo size={36} className="text-pf-ink" />
            <Link
              to="/"
              className="font-display text-2xl font-bold tracking-tight text-pf-ink"
            >
              FRAG
              <span className="text-pf-accent-ink bg-pf-accent px-1.5">
                STACK
              </span>
            </Link>
          </div>
          <nav className="hidden items-center gap-4 text-sm font-medium sm:flex">
            <Link to="/tournaments" className="text-pf-muted hover:text-pf-ink">
              Tournois
            </Link>
            <Link to="/teams" className="text-pf-muted hover:text-pf-ink">
              Équipes
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-pf-line/60" />
          ) : isAuthenticated && user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <Avatar size="sm">
                  {user.avatarUrl ? (
                    <Avatar.Image src={user.avatarUrl} alt={user.username} />
                  ) : null}
                  <Avatar.Fallback>
                    <HugeiconsIcon icon={UserIcon} size={14} />
                  </Avatar.Fallback>
                </Avatar>
                <span className="text-sm font-medium text-pf-ink">
                  {user.username}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                isPending={isLoggingOut}
                onPress={() => void logout()}
              >
                <HugeiconsIcon icon={Logout01Icon} size={16} />
                Logout
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onPress={loginWithSteam}>
              Sign in with Steam
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
