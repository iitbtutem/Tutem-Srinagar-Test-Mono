import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useAuthUser } from './useAuthUser';

export function useRider() {
  const { userId } = useAuthUser();

  const rider = useQuery(api.routes.rider.getRider, userId ? { userId } : 'skip');

  return {
    rider,
    isLoading: rider === undefined,
  };
}
