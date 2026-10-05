import { useEffect, useRef, useState } from "react";
import type { TournamentFixture } from "@/lib/types";

const CARD_W = 168;
const CARD_H = 52;
const COL_GAP = 56;
const ROW_GAP = 20;

type Props = {
  fixtures: TournamentFixture[];
  onSelect?: (fixture: TournamentFixture) => void;
  selectedId?: string | null;
};

export function BracketCanvas({ fixtures, onSelect, selectedId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const treeFixtures = fixtures.filter(
    (f) => f.bracketSide === "winners" || f.bracketSide === "losers" || f.bracketSide === "grand_final",
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !treeFixtures.length) return;

    const rounds = [...new Set(treeFixtures.map((f) => f.roundKey))].sort();
    const byRound = new Map<string, TournamentFixture[]>();
    for (const r of rounds) {
      byRound.set(
        r,
        treeFixtures.filter((f) => f.roundKey === r).sort((a, b) => a.position - b.position),
      );
    }

    const maxInRound = Math.max(...rounds.map((r) => byRound.get(r)!.length));
    const width = rounds.length * (CARD_W + COL_GAP) + 40;
    const height = maxInRound * (CARD_H + ROW_GAP) + 40;

    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    const positions = new Map<string, { x: number; y: number }>();

    rounds.forEach((roundKey, col) => {
      const list = byRound.get(roundKey)!;
      const blockH = maxInRound * (CARD_H + ROW_GAP);
      const startY = 20 + (blockH - list.length * (CARD_H + ROW_GAP)) / 2;
      list.forEach((f, i) => {
        const x = 20 + col * (CARD_W + COL_GAP);
        const y = startY + i * (CARD_H + ROW_GAP);
        positions.set(f.id, { x, y });

        const active = f.id === selectedId || f.id === hoverId;
        ctx.fillStyle = active ? "#fef3c7" : "#ffffff";
        ctx.strokeStyle = active ? "#f59e0b" : "#e5e7eb";
        ctx.lineWidth = active ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, CARD_W, CARD_H, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#111827";
        ctx.font = "600 12px system-ui";
        const t1 = (f.team1Name ?? "TBD").slice(0, 18);
        const t2 = (f.team2Name ?? "TBD").slice(0, 18);
        ctx.fillText(t1, x + 10, y + 20);
        ctx.fillText(t2, x + 10, y + 38);
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px system-ui";
        ctx.fillText(`${f.score1} – ${f.score2}`, x + CARD_W - 44, y + 28);
      });
    });

    for (const f of treeFixtures) {
      if (!f.nextMatchId) continue;
      const from = positions.get(f.id);
      const to = positions.get(f.nextMatchId);
      if (!from || !to) continue;
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(from.x + CARD_W, from.y + CARD_H / 2);
      ctx.lineTo(to.x - 8, from.y + CARD_H / 2);
      ctx.lineTo(to.x - 8, to.y + CARD_H / 2);
      ctx.lineTo(to.x, to.y + CARD_H / 2);
      ctx.stroke();
    }
  }, [treeFixtures, selectedId, hoverId]);

  function hitTest(ev: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const rounds = [...new Set(treeFixtures.map((f) => f.roundKey))].sort();
    const byRound = new Map<string, TournamentFixture[]>();
    for (const r of rounds) {
      byRound.set(
        r,
        treeFixtures.filter((f) => f.roundKey === r).sort((a, b) => a.position - b.position),
      );
    }
    const maxInRound = Math.max(...rounds.map((r) => byRound.get(r)!.length));

    for (let col = 0; col < rounds.length; col++) {
      const list = byRound.get(rounds[col]!)!;
      const blockH = maxInRound * (CARD_H + ROW_GAP);
      const startY = 20 + (blockH - list.length * (CARD_H + ROW_GAP)) / 2;
      for (let i = 0; i < list.length; i++) {
        const fx = 20 + col * (CARD_W + COL_GAP);
        const fy = startY + i * (CARD_H + ROW_GAP);
        if (x >= fx && x <= fx + CARD_W && y >= fy && y <= fy + CARD_H) {
          return list[i]!;
        }
      }
    }
    return null;
  }

  if (!treeFixtures.length) {
    return <p className="text-sm text-pf-muted">Pas de bracket arbre pour ce format.</p>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-pf-line/80 bg-white/50 p-4">
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        onMouseMove={(e) => setHoverId(hitTest(e)?.id ?? null)}
        onMouseLeave={() => setHoverId(null)}
        onClick={(e) => {
          const f = hitTest(e);
          if (f) onSelect?.(f);
        }}
      />
    </div>
  );
}
