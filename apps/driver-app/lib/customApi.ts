import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useMemo } from 'react';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';

// Strips `sessionToken` from the args the caller needs to provide,
// since `useAuthenticated*` injects it automatically.
type WithoutSessionToken<T> = Omit<T, 'sessionToken'>;

// ─── Query ──────────────────────────────────────────────────────────────────

export function useAuthenticatedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: WithoutSessionToken<FunctionArgs<Query>> | 'skip' = {} as WithoutSessionToken<FunctionArgs<Query>>
): FunctionReturnType<Query> | undefined {
  const { sessionToken } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `useQuery` internally types its second param as OptionalRestArgsOrSkip<Query>
  // (a complex conditional tuple). TypeScript can't unify our union through that
  // constraint, so we cast here. Type safety is enforced at the call site above.
  return useQuery(
    query,
    (args === 'skip' ? 'skip' : { ...args, sessionToken }) as any
  );
}

// ─── Mutation ────────────────────────────────────────────────────────────────

export function useAuthenticatedMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation
): (args?: WithoutSessionToken<FunctionArgs<Mutation>>) => Promise<FunctionReturnType<Mutation>> {
  const mutationFn = useMutation(mutation);
  const { sessionToken } = useAuth();

  return useMemo(() => {
    return async (args = {} as WithoutSessionToken<FunctionArgs<Mutation>>) => {
      return mutationFn({
        ...args,
        sessionToken,
      } as FunctionArgs<Mutation>);
    };
  }, [mutationFn, sessionToken]);
}

// ─── Action ──────────────────────────────────────────────────────────────────

export function useAuthenticatedAction<Action extends FunctionReference<'action'>>(
  action: Action
): (args?: WithoutSessionToken<FunctionArgs<Action>>) => Promise<FunctionReturnType<Action>> {
  const actionFn = useAction(action);
  const { sessionToken } = useAuth();

  return useMemo(() => {
    return async (args = {} as WithoutSessionToken<FunctionArgs<Action>>) => {
      return actionFn({
        ...args,
        sessionToken,
      } as FunctionArgs<Action>);
    };
  }, [actionFn, sessionToken]);
}
