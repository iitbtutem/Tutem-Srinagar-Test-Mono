import { api } from '@tutem/api';
import { useAuthenticatedQuery } from '@/hooks/customApi';

export function useDriver() {
  const driver = useAuthenticatedQuery(api.routes.driver.getUser);

  return {
    driver,
    isLoading: driver === undefined,
  };
}
