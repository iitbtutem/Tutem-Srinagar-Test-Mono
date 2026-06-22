import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { VEHICLE_CLASS } from '../../../packages/api/convex/CONSTANTS';
import { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { FunctionReturnType } from 'convex/server';
import { api, Id } from '@tutem/api';
import { cn, formatFare } from '@/lib/utils';
import { Text, Switch, Avatar, AvatarFallback, AvatarImage, GenderAge, Rating } from '@tutem/ui';
import { colors, VERIFICATION_CONFIG } from '@/constants/colors';

// Vehicle Icons
const VEHICLE_ICONS = {
  Cab: 'car',
  Bike: 'bike',
  Auto: 'rickshaw',
} as const;

// NearbyDrivers
type NearbyDriver = NonNullable<
  FunctionReturnType<typeof api.actions.actions.getNearbyDrivers>[number]
>;

type NearbyDriversProps = {
  drivers: NearbyDriver[];
  selectedDriver: Id<'driver'> | null;
  onSelect: (driver: NearbyDriver) => void;
  filters: ('Bike' | 'Auto' | 'Cab')[];
  setFilters: React.Dispatch<React.SetStateAction<('Bike' | 'Auto' | 'Cab')[]>>;
  riderGender: 'Male' | 'Female' | 'Other';
  genderMatch: boolean;
  setGenderMatch: React.Dispatch<React.SetStateAction<boolean>>;
  isSearchingDrivers?: boolean;
};

export default function NearbyDrivers({
  drivers,
  selectedDriver,
  onSelect,
  filters,
  setFilters,
  genderMatch,
  setGenderMatch,
  isSearchingDrivers = false,
}: NearbyDriversProps) {
  type VehicleClass = (typeof VEHICLE_CLASS)[number];

  return (
    <View className="mb-6 px-4 pt-2">
      {/* Filters */}
      <View className="mb-3 flex-row items-center">
        <BottomSheetFlatList
          data={VEHICLE_CLASS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item: VehicleClass) => item}
          contentContainerStyle={{ gap: 4 }}
          renderItem={({ item }: { item: VehicleClass }) => {
            const isSelected = filters.includes(item);
            return (
              <TouchableOpacity
                onPress={() => {
                  setFilters((prev) =>
                    prev.includes(item) ? prev.filter((el) => el !== item) : [...prev, item]
                  );
                }}
                className={cn(
                  'flex-row items-center gap-x-1 rounded-full border px-3 py-1',
                  isSelected ? 'border-primary bg-primary' : 'border-border bg-background'
                )}>
                <MaterialCommunityIcons
                  name={VEHICLE_ICONS[item]}
                  size={13}
                  color={isSelected ? 'white' : 'black'}
                />
                <Text
                  className={cn(
                    'text-sm',
                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                  )}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        <View className="flex-row items-center gap-2">
          <Text className="text-xs"> Gender{'\n'}Matching</Text>
          <Switch checked={genderMatch} onCheckedChange={setGenderMatch} />
        </View>
      </View>

      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-foreground">Nearby drivers</Text>
        {isSearchingDrivers ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className="text-xs text-muted-foreground">{drivers.length} available</Text>
        )}
      </View>

      {/* Driver list */}
      {drivers.length > 0 ? (
        <BottomSheetScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 3 }}>
          {drivers.map((driver) => {
            const isSelected = selectedDriver === driver.driver._id;
            const verificationStatus = driver?.driver?.isLicenseVerified;

            const licenseVerification = verificationStatus
              ? VERIFICATION_CONFIG[verificationStatus]
              : VERIFICATION_CONFIG['Pending'];

            return (
              <TouchableOpacity
                key={driver.driver._id}
                onPress={() => onSelect(driver)}
                activeOpacity={0.85}
                className={cn(
                  'flex-1 flex-row items-center justify-between gap-3 rounded-2xl border border-primary/50 px-1 py-2.5',
                  isSelected ? 'bg-primary/15' : 'bg-primary/0'
                )}>
                {/* Avatar and gender */}
                <View className="items-center justify-center gap-1.5">
                  <Avatar alt="Profile pic" className="h-14 w-14">
                    <AvatarImage
                      source={
                        driver.driver.userDetails.profilePictureKey?.trim()
                          ? { uri: driver.driver.userDetails?.profilePictureKey }
                          : require('@/assets/images/avatar.jpg')
                      }
                    />
                    <AvatarFallback className="bg-white/20">
                      <Text className="text-xs font-bold text-primary">
                        {driver.driver.userDetails?.firstName?.[0]}
                        {driver.driver.userDetails?.lastName?.[0]}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  <GenderAge
                    gender={driver.driver.userDetails?.gender}
                    dob={driver.driver.userDetails?.dob}
                  />
                </View>

                {/* Middle Content */}
                <View className="min-w-0 flex-1">
                  {/* Name + Verified */}
                  <Text className="font-semibold text-primary">
                    {driver.driver.userDetails.firstName} {driver.driver.userDetails.lastName}
                  </Text>

                  <Text className="text-xs font-medium">{driver.driver.organization.name}</Text>

                  <View className="flex-row items-center justify-start">
                    <MaterialCommunityIcons
                      name={VEHICLE_ICONS[driver.vehicle.class]}
                      size={16}
                      color={colors.primary}
                    />
                    <Text className="ml-2 text-lg text-primary">•</Text>
                    <Text className="text-sm text-slate-600">{driver.vehicle.color}</Text>
                    <Text className="ml-2 text-lg text-primary">•</Text>
                    <Text className="text-sm text-slate-600">{driver.vehicle.model}</Text>
                  </View>

                  {/* vehicle and driver rating and verification */}
                  <View className="mt-0.5 flex-row items-center gap-2">
                    <Rating rating={driver.driver.rating} />

                    {/* Verified Badge (inline, not floating) */}
                    {driver.driver.isLicenseVerified === 'Verified' && (
                      <View className="flex-row items-center gap-1">
                        <Feather
                          name={licenseVerification.icon as any}
                          size={12}
                          color={licenseVerification.color}
                        />
                        <Text
                          style={{ color: licenseVerification.color }}
                          className="text-[10px] font-semibold">
                          {licenseVerification.label}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Fare */}
                <Text className="px-1 text-base font-bold text-foreground">
                  {formatFare(driver.fare)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </BottomSheetScrollView>
      ) : (
        <Text>{isSearchingDrivers ? 'Searching for drivers...' : 'No nearby drivers.'}</Text>
      )}
    </View>
  );
}
