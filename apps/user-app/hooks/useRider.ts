import { api } from '@tutem/api';
import { useAuthenticatedQuery } from '@/hooks/customApi';

export function useRider() {
  const rider = useAuthenticatedQuery(api.routes.rider.getRider);

  return {
    rider,
    isLoading: rider === undefined,
  };
}
