import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useAuth } from './useAuth';

export function useDriver() {
  const { sessionToken } = useAuth();

  const driver = useQuery(api.routes.driver.getUser, sessionToken ? { sessionToken } : 'skip');

  return {
    driver,
    isLoading: driver === undefined,
  };
}
