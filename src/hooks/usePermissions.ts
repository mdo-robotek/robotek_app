import useSWR from 'swr';
import { useSession } from 'next-auth/react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function usePermissions() {
  const { data: session, status } = useSession();
  
  // @ts-ignore
  const userId = session?.user?.id;
  // @ts-ignore
  const initialPermissions = session?.user?.permissions || [];
  // @ts-ignore
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const { data, error, isLoading } = useSWR(
    userId ? `/api/users/${userId}/permissions` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60 * 60 * 1000,
    }
  );

  // Only block on loading if there is an active fetch (userId exists and SWR is fetching)
  // Don't block indefinitely when session itself is loading — AccessGuard handles that
  const isLoadingPermissions = !!userId && isLoading;

  return {
    permissions: data?.permissions || initialPermissions,
    isAdmin,
    isLoading: isLoadingPermissions,
    error
  };
}
