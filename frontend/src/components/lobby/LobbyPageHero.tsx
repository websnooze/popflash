import { motion } from "motion/react";

const MotionDiv = motion.div;

type LobbyPageHeroProps = {
  code: string;
  connected: boolean;
  team1Name: string;
  team2Name: string;
  bestOf: number;
  teamSize: number;
  location: string;
};

export function LobbyPageHero(props: LobbyPageHeroProps) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex flex-wrap items-end justify-between gap-3"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-pf-muted">
          Lobby #{props.code} · {props.connected ? "live" : "connecting…"}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {props.team1Name} <span className="text-pf-muted">vs</span> {props.team2Name}
        </h1>
      </div>
      <p className="text-sm text-pf-muted">
        BO{props.bestOf} · {props.teamSize}v{props.teamSize} · {props.location}
      </p>
    </MotionDiv>
  );
}
