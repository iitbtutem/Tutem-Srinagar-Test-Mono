import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { FlatList, View } from 'react-native';
import { RideHistoryCard as RideCard } from '../../../components/RideCard';
import { FunctionReturnType } from 'convex/server';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StarRating from '@/components/StarRating';
import { formatFare } from '@/lib/utils';
import useThemeColors from '@/hooks/useColorScheme';

type RideHistory = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getDriverHistory>[number]
>;

export default function History() {
  const { userId } = useAuth();
  const { iconColor, BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor} = useThemeColors();

  const [selectedRide, setSelectedRide] = useState<RideHistory | null>(null);

  const requestSheetRef = useRef<BottomSheet>(null);

  const user = useQuery(api.routes.driver.getDriver, userId ? { clerkId: userId } : "skip");
  const rides = useQuery(api.routes.rides.getDriverHistory, ( user && user.driverDetails ) ? { driverId: user.driverDetails?._id } : "skip" )
  
  const handleSelectRide = (ride: RideHistory) => {
    setSelectedRide(ride);
    requestSheetRef.current?.snapToIndex(1);
  }
  return (
    <View className="flex-1 bg-background p-4">
      <FlatList
      data={rides}
      renderItem={({ item: ride }) => (
        <RideCard
          key={ride._id}
          ride={ride}
          onPress={handleSelectRide}
        />
      )}
      />

      <BottomSheet
        ref={requestSheetRef}
        index={-1}
        snapPoints={['55%', '85%']}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} />
        )}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 40 }}
        onClose={() => {
          setSelectedRide(null);
          requestSheetRef.current?.close();
        }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
          {selectedRide && (
            <Animated.View entering={FadeInUp.duration(220)}>

              {/* Header */}
              <View className="flex-row justify-between items-start py-4 border-b border-slate-800 mb-5">
                <View className="flex-row items-center gap-x-1 pr-4">
                  {/* Avatar */}
                  <Avatar alt="Profile pic" className="h-12 w-12">
                    <AvatarImage
                      source={
                        selectedRide.rider?.userDetails?.profilePictureKey?.trim()
                          ? { uri: selectedRide.rider.userDetails.profilePictureKey }
                          : require('@/assets/images/avatar.jpg')
                      }
                    />
                    <AvatarFallback className="bg-white/20">
                      <Text className="text-sm font-bold text-primary">
                        {selectedRide.rider?.userDetails?.firstName?.[0]}
                        {selectedRide.rider?.userDetails?.lastName?.[0]}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  <Text className="text-primary text-[22px] font-extrabold tracking-tight mb-1.5">
                    {`${selectedRide.rider?.userDetails?.firstName ?? ''} ${selectedRide.rider?.userDetails?.lastName ?? ''}`.trim() || 'Passenger'}
                  </Text>
                  {selectedRide.rider && <StarRating rating={selectedRide.rider.rating} />}
                </View>
                <View className="items-end">
                  <Text className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-1">Est. Fare</Text>
                  <Text className="text-emerald-400 text-3xl font-extrabold tracking-tight">
                    {formatFare(selectedRide.fare)}
                  </Text>
                </View>
              </View>

              {/* Route visual */}
              <View className="flex-row gap-3 mb-5 px-1">
                <View className="items-center pt-[18px]">
                  <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <View className="w-px flex-1 bg-slate-700 my-1" />
                  <View className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                </View>
                <View className="flex-1">
                  <View className="mb-3.5">
                    <Text className="text-[10px] text-teal-400 font-bold tracking-[1.5px] uppercase mb-0.5">Pickup</Text>
                    <Text className="text-primary text-[15px] font-semibold leading-5">
                      {selectedRide.pickup?.address ?? 'Not set'}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-[10px] text-violet-400 font-bold tracking-[1.5px] uppercase mb-0.5">Destination</Text>
                    <Text className="text-primary text-[15px] font-semibold leading-5">
                      {selectedRide.destination?.address ?? 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View className="mb-5">
                <Text className="text-[10px] font-bold tracking-[1.5px] text-slate-600 uppercase mb-2.5">
                  Trip Details
                </Text>
                <View className="flex-row gap-2.5">
                  <View className="flex-1 bg-primary-background rounded-2xl border border-slate-800 p-3.5 items-center">
                    <Text className="text-primary text-base font-extrabold tracking-tight mb-1">
                      {selectedRide.distance} km
                    </Text>
                    <Text className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide">Distance</Text>
                  </View>
                  <View className="flex-1 bg-primary-background rounded-2xl border border-slate-800 p-3.5 items-center">
                    <Text className="text-primary text-base font-extrabold tracking-tight mb-1">
                      {selectedRide.expectedDuration ?? '—'}
                    </Text>
                    <Text className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide">Duration</Text>
                  </View>
                  <View className="flex-1 bg-primary-background rounded-2xl border border-slate-800 p-3.5 items-center">
                    <Text className="text-primary text-base font-extrabold tracking-tight mb-1">Now</Text>
                    <Text className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide">Scheduled</Text>
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
