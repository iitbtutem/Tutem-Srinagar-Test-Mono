import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useAuthUser } from './useAuthUser';

export function useRider() {
  const { sessionToken } = useAuthUser();

  const rider = useQuery(api.routes.rider.getRider, sessionToken ? { sessionToken } : 'skip');

  return {
    rider: !sessionToken ? null : rider,
    isLoading: !sessionToken ? false : rider === undefined,
  };
}
