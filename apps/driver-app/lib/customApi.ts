import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useMemo } from 'react';

export function useAuthenticatedQuery(query: any, args: Record<string, any> = {}) {
  const sessionToken = useAuth();

  return useQuery(query, {
    ...args,
    sessionToken,
  });
}

export function useAuthenticatedMutation(mutation: any) {
  const mutationFn = useMutation(mutation);
  const sessionToken = useAuth();

  return useMemo(() => {
    return async (args: Record<string, any> = {}) => {
      return mutationFn({
        ...args,
        sessionToken,
      });
    };
  }, [mutationFn, sessionToken]);
}

export function useAuthenticatedAction(action: any) {
  const actionFn = useAction(action);
  const sessionToken = useAuth();

  return useMemo(() => {
    return async (args: Record<string, any> = {}) => {
      return actionFn({
        ...args,
        sessionToken,
      });
    };
  }, [actionFn, sessionToken]);
}
