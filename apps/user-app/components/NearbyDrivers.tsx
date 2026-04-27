import { View } from "react-native";
import { VEHICLE_CLASS } from "../../../packages/api/convex/CONSTANTS";
import { BottomSheetFlatList, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { TouchableOpacity } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { FunctionReturnType } from "convex/server";
import { api, Id } from "@tutem/api";
import { cn } from "@/lib/utils";
import { Text } from "./ui/text";
import { Switch } from "./ui/switch";
import { VERIFICATION_CONFIG } from "@/constants/colors";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

// Vehicle Icons
const VEHICLE_ICONS = {
  Cab: 'car',
  Bike: 'bike',
  Auto: 'rickshaw',
} as const;

// NearbyDrivers
type NearbyDriver = NonNullable<
  FunctionReturnType<typeof api.routes.actions.getNearbyDrivers>[number]
>;

type NearbyDriversProps = {
  drivers: NearbyDriver[];
  selectedDriver: Id<"driver"> | null;
  onSelect: (driver: NearbyDriver) => void;
  isDark: boolean;
  filters: ('Bike' | 'Auto' | 'Cab')[];
  setFilters: React.Dispatch<React.SetStateAction<('Bike' | 'Auto' | 'Cab')[]>>;
  riderGender: 'Male' | 'Female' | 'Other';
  genderMatch: boolean;
  setGenderMatch: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function NearbyDrivers({
  drivers,
  selectedDriver,
  onSelect,
  isDark,
  filters,
  setFilters,
  genderMatch,
  setGenderMatch,
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
                  color={isDark ? (isSelected ? 'black' : 'white') : isSelected ? 'white' : 'black'}
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
        <View className='flex-row gap-2 items-center'>
          <Text className='text-xs'> Gender{"\n"}Matching</Text>
          <Switch checked={genderMatch} onCheckedChange={setGenderMatch}/>
        </View>
      </View>

      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-foreground">Nearby drivers</Text>
        <Text className="text-xs text-muted-foreground">{drivers.length} available</Text>
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
                style={{ minWidth: 160 }}
                className={cn(
                  'flex-row items-center gap-3 rounded-2xl border px-3 py-2.5',
                  isSelected
                    ? 'border-foreground bg-foreground/10'
                    : 'border-transparent bg-muted/20'
                )}>
                {/* Avatar */}
                <Avatar alt="Profile pic" className="h-9 w-9">
                  <AvatarImage
                    source={
                      driver.driver.userDetails.profilePictureKey?.trim()
                        ? { uri: driver.driver.userDetails.profilePictureKey }
                        : require('@/assets/images/avatar.jpg')
                    }
                  />
                  <AvatarFallback className="bg-white/20">
                    <Text className="text-xs font-bold text-primary">
                      {driver.driver.userDetails.firstName?.[0]}
                      {driver.driver.userDetails?.lastName?.[0]}
                    </Text>
                  </AvatarFallback>
                </Avatar>

                {/* Middle Content */}
                <View className="flex-1">
                  {/* Name + Verified */}
                  <View className="flex-row items-center gap-1.5">
                    <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                      {driver.driver.userDetails.firstName} {driver.driver.userDetails.lastName}
                    </Text>

                    {/* Verified Badge (inline, not floating) */}
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
                  </View>

                  {/* Gender + Vehicle */}
                  <View className="mt-0.5 flex-row items-center gap-2">
                    {driver.driver.averageRating && (
                      <>
                        <Ionicons name="star" size={12} color="orange" />
                        <Text className="text-xs text-muted-foreground">
                          {driver.driver.averageRating}
                        </Text>
                        <Text className="text-xs text-muted-foreground">•</Text>
                      </>
                    )}
                    {/* dot separator */}

                    <Text className="text-xs text-muted-foreground">{driver.vehicle.class}</Text>

                    <Text className="text-xs text-muted-foreground">•</Text>
                    
                    <View className="flex-row items-center gap-0.5">
                      <MaterialIcons
                        name={
                          driver.driver.userDetails.gender === 'Male'
                            ? 'male'
                            : driver.driver.userDetails.gender === 'Female'
                              ? 'female'
                              : 'transgender'
                        }
                        size={13}
                        color="rgba(255,255,255,0.5)"
                      />
                      <Text className="text-xs text-muted-foreground">
                        {driver.driver.userDetails.gender || 'N/A'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Fare */}
                <Text className="text-base font-bold text-foreground">₹{driver.fare}</Text>
              </TouchableOpacity>
            );
          })}
        </BottomSheetScrollView>
      ) : (
        <Text>No nearby drivers.</Text>
      )}
    </View>
  );
}