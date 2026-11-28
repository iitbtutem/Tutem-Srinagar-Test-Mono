import { useRider } from '@/hooks/useRider';
import { api } from '@tutem/api';
import { usePaginatedQuery } from 'convex/react';
import { FlatList, View } from 'react-native';
import { RideHistoryCard as RideCard, RideCardSkeleton } from '@/components/RideCard';
import { Text } from '@tutem/ui';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

const PAGE_SIZE = 10;
const CONTENT_CONTAINER_STYLE = {
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 24,
};

const Separator = () => <View style={{ height: 12 }} />;

export default function History() {
  const { rider: user } = useRider();
  const { sessionToken } = useAuth();

  const { results, status, loadMore } = usePaginatedQuery(
    api.routes.rides.getRiderHistory,
    user?.riderDetails && sessionToken ? { riderId: user.riderDetails._id, sessionToken } : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  const isInitialLoading = status === 'LoadingFirstPage';
  const isLoadingMore = status === 'LoadingMore';
  const isDone = status === 'Exhausted';

  const keyExtractor = useCallback((item: (typeof results)[number]) => item._id, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof results)[number] }) => (
      <RideCard ride={item} onPress={() => router.push(`/ride/${item._id}`)} />
    ),
    []
  );

  const onEndReached = useCallback(() => {
    if (!isDone && !isLoadingMore) {
      loadMore(PAGE_SIZE);
    }
  }, [isDone, isLoadingMore, loadMore]);

  const ListHeader = useCallback(() => {
    if (isInitialLoading)
      return (
        <>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <RideCardSkeleton key={i} />
          ))}
        </>
      );
    if (results.length > 0)
      return (
        <View className="mb-3 flex-row items-center gap-2 border-b border-border/40 px-3 py-2">
          <Text className="text-base font-bold text-foreground">Previous Rides</Text>
          <View className="min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5">
            <Text className="text-xs font-extrabold text-primary">{results.length}</Text>
          </View>
        </View>
      );
    return null;
  }, [isInitialLoading, results.length]);

  const ListEmpty = useCallback(() => {
    if (isInitialLoading) return null;
    return (
      <View className="flex-1 items-center justify-center px-4 py-6">
        <Feather name="clock" size={96} color="#f59e0b" />
        <Text className="mt-4 text-center text-xl font-semibold text-foreground">No Rides found</Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          There are no previous rides available.
        </Text>
      </View>
    );
  }, [isInitialLoading]);

  const ListFooter = useCallback(() => {
    if (isInitialLoading) return null;
    if (isLoadingMore)
      return (
        <View className="py-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <RideCardSkeleton key={i} />
          ))}
        </View>
      );
    if (isDone && results.length > 0)
      return (
        <View className="items-center py-4">
          <Text className="text-xs text-gray-400">End of list</Text>
        </View>
      );
    return null;
  }, [isInitialLoading, isLoadingMore, isDone, results.length]);

  if (!isInitialLoading && results.length === 0) {
    return (
      <View className="flex-1 bg-slate-50">
        <ListEmpty />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={isInitialLoading ? [] : results}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
      />
    </View>
  );
}
