import {
  AntDesign,
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
} from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './ui/text';
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
import { useState } from 'react';
import { useColorScheme } from 'nativewind';
import useThemeColors from '@/hooks/useColorScheme';
import { useToast } from './CustomToast';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { QrCode } from 'lucide-react-native';

type User = FunctionReturnType<typeof api.routes.driver.getUser>;
type Props = {
  navigation: any;
  options: any;
  back?: any;
  user: User;
};

export default function CustomHeader({ navigation, options, back, user }: Props) {
  const { showToast } = useToast();
  const {colorScheme}= useColorScheme();
  const isDark = colorScheme === "dark";

  const toggleAvailability = useMutation(api.routes.driver.toggleAvailability);
  const [genderMatching, setGenderMatching] = useState<boolean>(false);
  
  if (!user) return;
  return (
    <View>
      <SafeAreaView edges={['top']} className="bg-primary" />
      <View className="bg-primary flex-row items-center justify-between gap-3 px-4 pb-1.5">
        {/* Availability Toggle */}
        {back ? (
          <TouchableOpacity className="mr-2 flex-row gap-2 items-center" onPress={() => navigation.goBack()}>
            <MaterialIcons
              name="keyboard-backspace"
              size={24}
              color={'#000'}
            />
            <Text className='font-semibold text-md'>Back</Text>
          </TouchableOpacity>
        ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          className={cn('flex-row items-center gap-2 rounded-2xl px-2.5 py-1.5', {
            'bg-green-100': user.driverDetails?.isOnline,
            'bg-red-100': !user.driverDetails?.isOnline,
          })}
          onPress={async () => {
            if (!user.driverDetails) return;
            try {
              await toggleAvailability({ id: user.driverDetails._id });
            } catch (error: any) {
              console.log("error", error);
              showToast({
                type: "error",
                title: "Failed",
                description: error.data ?? "Failed to switch"
              })
            }
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
        </TouchableOpacity>)}

        <View className="flex-1 flex-row items-center justify-end gap-3">
          <View className="flex-1 items-end">
            <Text className="text-md text-title font-semibold">{`${user.firstName}`}</Text>
            <View className="flex-row items-center gap-1 px-1">
              <View
                className={cn('h-1.5 w-1.5 rounded-full bg-green-500', {
                  'bg-red-500': !user.driverDetails?.isAvailableForRide,
                })}
              />
              <Text className="text-title/80 text-xs italic">{`${user.driverDetails?.isAvailableForRide ? 'Available' : 'Not Available'}`}</Text>
            </View>
          </View>

          <ProfileDropdown
            user={user}
            genderMatching={genderMatching}
            setGenderMatching={setGenderMatching}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
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
  const logout = useMutation(api.routes.driver.logout);

  const { iconColor } = useThemeColors();

  const handleLogout = async () => {
    if (
      user === undefined ||
      user?.driverDetails === undefined ||
      user.driverDetails?._id === undefined
    )
      return;

    const driverId = user.driverDetails._id;

    await logout({ driverId });
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
          <Avatar alt="Profile pic" className="h-9 w-9">
            <AvatarImage source={{ uri: user.profilePictureKey }} />
            <AvatarFallback className="bg-white/20">
              <Text className="text-2xl font-bold text-white">
                {!user.profilePictureKey ? user.firstName[0]?.toUpperCase() : 'D'}
              </Text>
            </AvatarFallback>
          </Avatar>
        </TouchableOpacity>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="native:w-64 elevation-lg shadow-lg/20 w-60 rounded-2xl bg-white/95 shadow-black backdrop-blur-xl">
        <Animated.View entering={FadeIn.duration(200)}>
          <View className="bg-primary/5 px-4 py-1">
            <Text className="text-lg font-bold text-primary">Menu</Text>
          </View>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild closeOnPress className='py-1'>
              <Link href={'/profile'}>
                <View className="flex-row items-center gap-3 px-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <FontAwesome5 name="user" size={18} color="rgb(0, 80, 200)" />
                  </View>
                  <Text className="text-base font-medium text-primary">Profile</Text>
                </View>
              </Link>
            </DropdownMenuItem>

            {/* Gender matching switch */}
            <DropdownMenuItem className='py-1'>
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
            </DropdownMenuItem>

            {user.driverDetails && <DropdownMenuItem asChild closeOnPress className='py-1'>
              <Link href={{
                pathname: '/paymentQrCode',
                params: { driverId: (user.driverDetails._id).toString() }
              }}>
                <View className="flex-row items-center gap-3 px-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-orange-500/10">
                    <QrCode size={18} color="#f59e0b" strokeWidth={2} />
                  </View>
                  <Text className="text-base font-medium text-primary">Payment QR Code</Text>
                </View>
              </Link>
            </DropdownMenuItem>}
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

export function BasicHeader({ navigation, options, back }: NativeStackHeaderProps) {
  return (
    <View>
      <SafeAreaView edges={['top']} className="bg-primary" />
      <View className="bg-primary flex-row items-center justify-between gap-3 px-4 pb-2">
        
        {back ? (
          <TouchableOpacity className="mr-2 flex-row gap-2 items-center" onPress={() => navigation.goBack()}>
            <MaterialIcons
              name="keyboard-backspace"
              size={24}
              color={'#000'}
            />
            <Text className='font-semibold text-md'>{options.headerBackTitle ?? "Back"}</Text>
          </TouchableOpacity>
        ) : (
          <View className="min-w-[72px]" />
        )}

        <Text className="flex-1 font-semibold text-center text-base text-slate-900">
          {options.title ?? ''}
        </Text>
        <View className='w-1/4' />
      </View>
    </View>
  );
}
