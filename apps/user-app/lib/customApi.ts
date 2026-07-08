import { useAuthUser } from '@/hooks/useAuthUser';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useMemo } from 'react';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';

type WithoutSessionToken<T> = Omit<T, 'sessionToken'>;

export function useAuthenticatedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: WithoutSessionToken<FunctionArgs<Query>> | 'skip' = {} as WithoutSessionToken<
    FunctionArgs<Query>
  >
): FunctionReturnType<Query> | undefined {
  const { sessionToken } = useAuthUser();

  return useQuery(query, (args === 'skip' ? 'skip' : { ...args, sessionToken }) as any);
}

export function useAuthenticatedMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation
): (args?: WithoutSessionToken<FunctionArgs<Mutation>>) => Promise<FunctionReturnType<Mutation>> {
  const mutationFn = useMutation(mutation);
  const { sessionToken } = useAuthUser();

  return useMemo(() => {
    return async (args = {} as WithoutSessionToken<FunctionArgs<Mutation>>) => {
      return mutationFn({
        ...args,
        sessionToken,
      } as FunctionArgs<Mutation>);
    };
  }, [mutationFn, sessionToken]);
}

export function useAuthenticatedAction<Action extends FunctionReference<'action'>>(
  action: Action
): (args?: WithoutSessionToken<FunctionArgs<Action>>) => Promise<FunctionReturnType<Action>> {
  const actionFn = useAction(action);
  const { sessionToken } = useAuthUser();

  return useMemo(() => {
    return async (args = {} as WithoutSessionToken<FunctionArgs<Action>>) => {
      return actionFn({
        ...args,
        sessionToken,
      } as FunctionArgs<Action>);
    };
  }, [actionFn, sessionToken]);
}
