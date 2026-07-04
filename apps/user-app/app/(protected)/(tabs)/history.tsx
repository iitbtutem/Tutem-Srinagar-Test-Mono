import { useRider } from '@/hooks/useRider';
import { api } from '@tutem/api';
import { usePaginatedQuery } from 'convex/react';
import { FlatList, View } from 'react-native';
import { RideHistoryCard as RideCard, RideCardSkeleton } from '@/components/RideCard';
import { Text } from '@tutem/ui';
import Rides from '@/assets/svgs/rides';
import { router } from 'expo-router';

const PAGE_SIZE = 10;

export default function History() {
  const { rider: user } = useRider();

  const { results, status, loadMore } = usePaginatedQuery(
    api.routes.rides.getRiderHistory,
    user && user.riderDetails ? { riderId: user.riderDetails._id } : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  const isInitialLoading = status === 'LoadingFirstPage';
  const isLoadingMore = status === 'LoadingMore';
  const isDone = status === 'Exhausted';

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={isInitialLoading ? [] : results}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <RideCard ride={item} onPress={() => router.push(`/ride/${item._id}`)} />
        )}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (!isDone && !isLoadingMore) {
            loadMore(PAGE_SIZE);
          }
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 24,
          flexGrow: !isInitialLoading && results.length === 0 ? 1 : undefined,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={() => {
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
              <View className="mb-3 flex-row justify-between rounded-lg bg-violet-400/10 px-3 py-2">
                <Text className="text-title text-lg font-bold">Previous Rides</Text>
                <Text className="text-sm text-gray-500">
                  {results.length}
                  {results.length === 1 ? 'ride' : 'rides'}
                </Text>
              </View>
            );
        }}
        ListEmptyComponent={() =>
          !isInitialLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <Rides width={302} height={400} />
              <Text className="text-titles mt-4 text-xl font-semibold">No rides found</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">
                There are no previous rides available.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={() => {
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
        }}
      />
    </View>
  );
}
