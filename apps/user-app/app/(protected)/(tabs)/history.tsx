import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { FlatList, View } from 'react-native';
import { RideHistoryCard as RideCard } from '@/components/RideCard';
import { FunctionReturnType } from 'convex/server';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Avatar, AvatarFallback, AvatarImage, Text, Loader } from '@tutem/ui';
import StarRating from '@/components/StarRating';
import { formatFare } from '@/lib/utils';
import useThemeColors from '@/hooks/useColorScheme';
import Rides from '@/assets/svgs/rides';
import { distanceFormat } from '@/lib/utils';
import { router } from 'expo-router';

type RideHistory = NonNullable<FunctionReturnType<typeof api.routes.rides.getRiderHistory>[number]>;

export default function History() {
  const { userId } = useAuth();
  const { iconColor, BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor } =
    useThemeColors();

  const [selectedRide, setSelectedRide] = useState<RideHistory | null>(null);

  const user = useQuery(api.routes.rider.getRider, userId ? { clerkId: userId } : 'skip');
  const rides = useQuery(
    api.routes.rides.getRiderHistory,
    user && user.riderDetails ? { riderId: user.riderDetails?._id } : 'skip'
  );

  if (rides === undefined)
    return <Loader subtitle='loading previous rides...' />;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={rides}
        keyExtractor={(item) => item._id}
        // renderItem={({ item }) => <RideCard ride={item} onPress={handleSelectRide} />}

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
          <View className="flex-1 items-center justify-center py-20">
            <Rides width={302} height={400} />
            <Text className="text-titles mt-4 text-xl font-semibold">No rides found</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              There are currently no rides available.
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
