import {
  AntDesign,
  Feather,
  FontAwesome5,
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
} from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './ui/text';
import { iconColor } from '@/constants/colors';
import { cn } from '@/lib/utils';
import { FunctionReturnType } from 'convex/server';
import { api, Id } from '@tutem/api';
import { useAuth } from '@clerk/expo';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Link, router } from 'expo-router';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useMutation } from 'convex/react';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { useState } from 'react';
import { mutation } from '../../../packages/api/convex/_generated/server';
import { useColorScheme } from 'nativewind';

type User = FunctionReturnType<typeof api.routes.driver.getDriver>;
type Props = {
  navigation: any;
  options: any;
  back?: any;
  user: User;
};

export default function CustomHeader({ navigation, options, back, user }: Props) {
  if (!user) return;
  const toggleAvailability = useMutation(api.routes.driver.toggleAvailability);
  const [genderMatching, setGenderMatching] = useState<boolean>(false);

  const {colorScheme}= useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView className="bg-primary-background h-[110px] flex-row items-center justify-between gap-3 bg-cyan-500 px-4">
      {/* Availability Toggle */}
      <TouchableOpacity
        activeOpacity={0.8}
        className={cn('flex-row items-center gap-2 rounded-2xl px-2.5 py-1.5', {
          'bg-green-100': user.driverDetails?.isOnline,
          'bg-red-100': !user.driverDetails?.isOnline,
        })}
        onPress={async () => {
          if (!user.driverDetails) return;
          await toggleAvailability({ id: user.driverDetails._id });
        }}>
        <View
          className={cn('h-7 w-7 items-center justify-center rounded-full', {
            'bg-green-500': user.driverDetails?.isOnline,
            'bg-red-600': !user.driverDetails?.isOnline,
          })}>
          <Feather name="power" size={16} color="white" />
        </View>

        <View>
          <Text className="text-[10px] text-gray-500">Status</Text>
          <Text className={cn("text-xs font-semibold text-primary", {"text-black": isDark})}>
            {user.driverDetails?.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </TouchableOpacity>

      <View className="flex-row items-center gap-3">
        <View className="items-end">
          <Text className="text-md text-title font-semibold">{`${user.firstName}`}</Text>
          <View className="flex-row items-center gap-1">
            <View
              className={cn('h-1.5 w-1.5 rounded-full bg-green-500', {
                'bg-red-500': !user.driverDetails?.isAvailableForRide,
              })}
            />
            <Text className="text-title/80 text-xs italic">{`${user.driverDetails?.isAvailableForRide ? 'Available' : 'Booked'}`}</Text>
          </View>
        </View>

        <ProfileDropdown
          user={user}
          genderMatching={genderMatching}
          setGenderMatching={setGenderMatching}
          isDark={isDark}
        />
      </View>
    </SafeAreaView>
  );
}

function ProfileDropdown({
  user,
  genderMatching,
  setGenderMatching,
  isDark
}: {
  user: User;
  genderMatching: boolean;
  setGenderMatching: React.Dispatch<React.SetStateAction<boolean>>;
  isDark: boolean
}) {
  const { signOut } = useAuth();
  const removeExpoPushToken = useMutation(api.routes.driver.removeExpoPushToken);

  const handleLogout = async () => {
    if (
      user === undefined ||
      user?.driverDetails === undefined ||
      user.driverDetails?._id === undefined
    )
      return;

    const driverId = user.driverDetails._id;

    await removeExpoPushToken({ driverId });
    await signOut();
    router.replace('/(auth)/signin');
  };

  if (user === null) return;

  const toggleGenderMatching = useMutation(api.routes.driver.toggleGenderMatching);

  const toggleGenderMatch = async () => {
    if (user.driverDetails === null) return;
    await toggleGenderMatching({ id: user.driverDetails._id });
    setGenderMatching((prev) => !prev);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity
          className={cn(
            'rounded-full border-2',
            { 'border-green-600': user.driverDetails?.isAvailableForRide },
            { 'border-red-600': !user.driverDetails?.isAvailableForRide },
            {"bg-blue-600/60": isDark}
          )}>
          <Avatar alt="Profile pic" className="h-11 w-11">
            <AvatarImage source={{ uri: user.profilePictureKey }} />
            <AvatarFallback className="bg-white/20">
              <Text className="text-2xl font-bold text-primary">
                {!user.profilePictureKey ? user.firstName[0]?.toUpperCase() : 'D'}
              </Text>
            </AvatarFallback>
          </Avatar>
        </TouchableOpacity>
      </DropdownMenuTrigger>

      <DropdownMenuContent className={cn("native:w-72 elevation-lg shadow-lg/20 w-60 rounded-3xl bg-white/95 shadow-black backdrop-blur-xl", {"bg-black": isDark})}>
        <Animated.View entering={FadeIn.duration(200)}>
          <View className="bg-primary/5 px-4 py-2">
            <Text className="text-lg font-bold text-primary">Menu</Text>
          </View>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild closeOnPress>
              <Link href={'/profile'}>
                <View className="flex-row items-center gap-3 px-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <FontAwesome5 name="user" size={18} color={iconColor} />
                  </View>
                  <Text className="text-base font-medium text-primary">Profile</Text>
                </View>
              </Link>
            </DropdownMenuItem>

            {/* Gender matching switch */}
            <View className="px-2 py-2">
              <View className="flex-row items-center gap-3 px-2">
                <View className="h-8 w-8 items-center justify-center">
                  {/* <Checkbox checked={genderMatching} onCheckedChange={setGenderMatching}/> */}
                  <Switch checked={genderMatching} onCheckedChange={toggleGenderMatch} />
                </View>
                <Text
                  onPress={() => setGenderMatching((prev) => !prev)}
                  className="text-base font-medium text-primary">
                  Gender Matching
                </Text>
              </View>
            </View>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <TouchableOpacity
              onPress={handleLogout}
              className="w-full flex-row items-center gap-3 px-2 pb-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-red-50">
                <MaterialIcons name="logout" size={18} color={'red'} />
              </View>
              <Text className="text-base font-medium text-destructive">Sign Out</Text>
            </TouchableOpacity>
          </DropdownMenuItem>
        </Animated.View>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
