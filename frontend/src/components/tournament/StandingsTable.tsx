import type { StandingRow, TournamentEntry } from "@/lib/types";

type Props = {
  standings: StandingRow[];
  entries: TournamentEntry[];
};

export function StandingsTable({ standings, entries }: Props) {
  const nameByEntry = new Map(entries.map((e) => [e.id, e.teamName]));

  if (!standings.length) {
    return <p className="text-sm text-pf-muted">Aucun résultat pour le moment.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-pf-line/80">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-pf-line/30 text-xs uppercase tracking-wide text-pf-muted">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Équipe</th>
            <th className="px-4 py-2">V</th>
            <th className="px-4 py-2">D</th>
            <th className="px-4 py-2">N</th>
            <th className="px-4 py-2">Diff maps</th>
            <th className="px-4 py-2">Buchholz</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.entryId} className="border-t border-pf-line/60">
              <td className="px-4 py-2">{i + 1}</td>
              <td className="px-4 py-2 font-medium">{nameByEntry.get(row.entryId) ?? row.entryId}</td>
              <td className="px-4 py-2">{row.wins}</td>
              <td className="px-4 py-2">{row.losses}</td>
              <td className="px-4 py-2">{row.draws}</td>
              <td className="px-4 py-2">{row.mapDiff}</td>
              <td className="px-4 py-2">{row.buchholz}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
