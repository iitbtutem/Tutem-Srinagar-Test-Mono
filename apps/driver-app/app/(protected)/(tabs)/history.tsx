import { Text } from '@tutem/ui';
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { FlatList, View } from 'react-native';
import { RideHistoryCard as RideCard } from '../../../components/RideCard';
import useThemeColors from '@/hooks/useColorScheme';
import RideSvg from '@/assets/svgs/rides';
import { router } from 'expo-router';
import Loader from '@/components/Loader';

export default function History() {
  const { userId } = useAuth();
  const { iconColor } = useThemeColors();

  const user = useQuery(api.routes.driver.getUser, userId ? { clerkId: userId } : 'skip');
  const rides = useQuery(
    api.routes.rides.getDriverHistory,
    user && user.driverDetails ? { driverId: user.driverDetails?._id } : 'skip'
  );

  if (rides === undefined)
    return <View className="flex-1 bg-background">
      <Loader subtitle='Loading previous rides...' />
    </View>;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={rides}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <RideCard ride={item} onPress={() => router.push(`/ride/${item._id}`)} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 24,
          flexGrow: rides.length === 0 ? 1 : undefined,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={() => {
          if (rides.length > 0)
            return (
              <View className="mb-3 flex-row justify-between rounded-lg bg-violet-400/10 px-3 py-2">
                <Text className="text-title text-lg font-bold">Previous Rides</Text>
                <Text className="text-sm text-gray-500">
                  {rides.length} {rides.length === 1 ? 'ride' : 'rides'}
                </Text>
              </View>
            );
        }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20 mb-20">
            <RideSvg width={330} height={200} />
            <Text className="text-titles mt-4 text-xl font-semibold">No rides found</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              There are no previous rides available.
            </Text>
          </View>
        )}
        ListFooterComponent={() =>
          rides.length > 0 ? (
            <View className="items-center py-4">
              <Text className="text-xs text-gray-400">End of list</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
