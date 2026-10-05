import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, Card } from "@heroui/react";
import { tournamentApi } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";

const FORMAT_LABEL: Record<string, string> = {
  single_elim: "Single elim",
  double_elim: "Double elim",
  swiss: "Swiss",
  round_robin: "Round robin",
};

export function TournamentsPage() {
  const { isAuthenticated, loginWithSteam } = useAuth();
  const query = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => (await tournamentApi.list()).tournaments,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-pf-ink">Tournois</h1>
          <p className="mt-2 text-pf-muted">Brackets, inscriptions et lobbies de match.</p>
        </div>
        {isAuthenticated ? (
          <Link
            to="/tournaments/new"
            className="inline-flex items-center rounded-lg bg-pf-accent px-4 py-2 text-sm font-semibold text-pf-accent-ink"
          >
            Créer un tournoi
          </Link>
        ) : (
          <Button variant="primary" onPress={loginWithSteam}>
            Connexion pour organiser
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-pf-muted">Chargement…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(query.data ?? []).map((t) => (
            <Card key={t.id} className="border border-pf-line/80 p-4">
              {t.imageUrl ? (
                <img
                  src={t.imageUrl}
                  alt=""
                  className="mb-3 h-32 w-full rounded-lg object-cover"
                />
              ) : null}
              <Link
                to="/tournaments/$slug"
                params={{ slug: t.slug }}
                className="font-display text-xl font-semibold text-pf-ink hover:underline"
              >
                {t.title}
              </Link>
              <p className="mt-1 text-sm text-pf-muted line-clamp-2">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-pf-muted">
                <span>{FORMAT_LABEL[t.format] ?? t.format}</span>
                <span>·</span>
                <span>{t.entryCount}/{t.maxTeams} équipes</span>
                <span>·</span>
                <span>{t.status}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
