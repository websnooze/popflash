import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/client";
import type { User } from "@/lib/types";

export const authQueryKey = ["auth", "me"] as const;

export function useAuth() {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: async (): Promise<User | null> => {
      try {
        const data = await authApi.me();
        return data.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null);
    },
  });

  return {
    user: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    loginWithSteam: () => {
      window.location.href = authApi.steamLoginUrl();
    },
    logout: () => logoutMutation.mutateAsync(),
    isLoggingOut: logoutMutation.isPending,
    refetch: meQuery.refetch,
  };
}
