import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useAuth } from './useAuth';

export function useDriver() {
  const { userId } = useAuth();

  const driver = useQuery(api.routes.driver.getUser, userId && userId !== '' ? { userId } : 'skip');

  return {
    driver,
    isLoading: driver === undefined,
  };
}
