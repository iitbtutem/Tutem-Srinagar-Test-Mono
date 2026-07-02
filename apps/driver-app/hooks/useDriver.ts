import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useAuth } from './useAuth';

export function useDriver() {
  const { sessionToken } = useAuth();

  const driver = useQuery(api.routes.driver.getUser, sessionToken ? { sessionToken } : 'skip');

  return {
    driver: !sessionToken ? null : driver,
    isLoading: !sessionToken ? false : driver === undefined,
  };
}
