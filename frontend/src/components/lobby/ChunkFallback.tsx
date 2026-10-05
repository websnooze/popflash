import { Suspense, type ReactNode } from "react";
import { Spinner } from "@heroui/react";

export function ChunkFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-pf-muted">
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  );
}

export function LazyBoundary({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return <Suspense fallback={<ChunkFallback label={label} />}>{children}</Suspense>;
}
