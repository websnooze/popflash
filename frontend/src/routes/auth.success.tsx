import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Spinner } from "@heroui/react";
import { useAuth } from "@/hooks/useAuth";

export function AuthSuccessPage() {
  const navigate = useNavigate();
  const { refetch, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    void (async () => {
      await refetch();
      void navigate({ to: "/" });
    })();
  }, [navigate, refetch]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-pf-muted">
        {isLoading || !isAuthenticated ? "Finishing Steam login…" : "Redirecting…"}
      </p>
    </div>
  );
}
