import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { teamApi } from "@/lib/client";

export function TeamDetailPage() {
  const { id } = useParams({ from: "/teams/$id" });
  const query = useQuery({
    queryKey: ["team", id],
    queryFn: async () => (await teamApi.get(id)).team,
  });

  const team = query.data;
  if (query.isLoading || !team) {
    return <p className="p-10 text-center text-pf-muted">Chargement…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : null}
        <div>
          <h1 className="font-display text-3xl font-bold text-pf-ink">{team.name}</h1>
          {team.tag ? <p className="text-pf-muted">[{team.tag}]</p> : null}
        </div>
      </div>
      <h2 className="mt-8 font-display text-lg font-semibold">Roster</h2>
      <ul className="mt-3 space-y-2">
        {team.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between rounded-lg border border-pf-line/80 px-4 py-2">
            <span>{m.username}</span>
            <span className="text-xs uppercase text-pf-muted">{m.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
