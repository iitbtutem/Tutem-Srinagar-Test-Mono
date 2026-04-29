import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { RideHistoryCard as RideCard } from '@/components/RideCard';
import { FunctionReturnType } from 'convex/server';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StarRating from '@/components/StarRating';
import { formatFare } from '@/lib/utils';
import useThemeColors from '@/hooks/useColorScheme';
import Rides from '@/assets/svgs/rides';

type RideHistory = NonNullable<FunctionReturnType<typeof api.routes.rides.getRiderHistory>[number]>;

export default function History() {
  const { userId } = useAuth();
  const { iconColor, BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor } =
    useThemeColors();

  const [selectedRide, setSelectedRide] = useState<RideHistory | null>(null);

  const requestSheetRef = useRef<BottomSheet>(null);

  const user = useQuery(api.routes.rider.getRider, userId ? { clerkId: userId } : 'skip');
  const rides = useQuery(
    api.routes.rides.getRiderHistory,
    user && user.riderDetails ? { riderId: user.riderDetails?._id } : 'skip'
  );

  const handleSelectRide = (ride: RideHistory) => {
    setSelectedRide(ride);
    requestSheetRef.current?.snapToIndex(1);
  };

  if (rides === undefined)
    return <ActivityIndicator className="flex-1" color={iconColor} size="large" />;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={rides}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <RideCard ride={item} onPress={handleSelectRide} />}
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

      <BottomSheet
        ref={requestSheetRef}
        index={-1}
        snapPoints={['55%', '85%']}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.55}
          />
        )}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 40 }}
        onClose={() => {
          setSelectedRide(null);
          requestSheetRef.current?.close();
        }}>
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
          {selectedRide && (
            <Animated.View entering={FadeInUp.duration(220)}>
              {/* Header */}
              <View className="mb-5 flex-row items-start justify-between border-b border-slate-800 py-4">
                {/* LEFT */}
                <View className="min-w-0 flex-1 flex-row items-center gap-x-1 pr-4">
                  <Avatar alt="Profile pic" className="h-12 w-12">
                    <AvatarImage
                      source={
                        selectedRide.driver?.userDetails?.profilePictureKey?.trim()
                          ? { uri: selectedRide.driver.userDetails.profilePictureKey }
                          : require('@/assets/images/avatar.jpg')
                      }
                    />
                    <AvatarFallback className="bg-white/20">
                      <Text className="text-sm font-bold text-primary">
                        {selectedRide.driver?.userDetails?.firstName?.[0]}{' '}
                        {selectedRide.driver?.userDetails?.lastName?.[0]}{' '}
                      </Text>
                    </AvatarFallback>
                  </Avatar>

                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      className="mb-1.5 text-[22px] font-extrabold tracking-tight text-primary">
                      {`${selectedRide.driver?.userDetails?.firstName ?? ''} ${selectedRide.driver?.userDetails?.lastName ?? ''}`.trim() ||
                        'Passenger'}
                    </Text>

                    {selectedRide.driver && <StarRating rating={selectedRide.driver.rating} />}
                  </View>
                </View>

                {/* RIGHT */}
                <View className="flex-shrink-0 items-end">
                  <Text className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Est. Fare
                  </Text>
                  <Text className="text-3xl font-extrabold tracking-tight text-emerald-400">
                    {formatFare(selectedRide.fare)}
                  </Text>
                </View>
              </View>

              {/* Route visual */}
              <View className="mb-5 flex-row gap-3 px-1">
                <View className="items-center pt-[18px]">
                  <View className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <View className="my-1 w-px flex-1 bg-slate-700" />
                  <View className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                </View>
                <View className="flex-1">
                  <View className="mb-3.5">
                    <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-teal-400">
                      Pickup
                    </Text>
                    <Text className="text-[15px] font-semibold leading-5 text-primary">
                      {selectedRide.pickup?.address ?? 'Not set'}
                    </Text>
                  </View>
                  <View>
                    <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-violet-400">
                      Destination
                    </Text>
                    <Text className="text-[15px] font-semibold leading-5 text-primary">
                      {selectedRide.destination?.address ?? 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View className="mb-5">
                <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-[1.5px] text-slate-600">
                  Trip Details
                </Text>
                <View className="flex-row gap-2.5">
                  <View className="bg-primary-background flex-1 items-center rounded-2xl border border-slate-800 p-3.5">
                    <Text className="mb-1 text-base font-extrabold tracking-tight text-primary">
                      {selectedRide.distance} km
                    </Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Distance
                    </Text>
                  </View>
                  <View className="bg-primary-background flex-1 items-center rounded-2xl border border-slate-800 p-3.5">
                    <Text className="mb-1 text-base font-extrabold tracking-tight text-primary">
                      {selectedRide.expectedDuration ?? '—'}
                    </Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Duration
                    </Text>
                  </View>
                  <View className="bg-primary-background flex-1 items-center rounded-2xl border border-slate-800 p-3.5">
                    <Text className="mb-1 text-base font-extrabold tracking-tight text-primary">
                      Now
                    </Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Scheduled
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
