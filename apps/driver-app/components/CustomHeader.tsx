import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { cn } from '@/lib/utils';
import { FunctionReturnType } from 'convex/server';
import { api } from '@tutem/api';
import { useAuth } from '@/hooks/useAuth';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Link } from 'expo-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Text,
  Switch,
} from '@tutem/ui';
import { useState } from 'react';
import { useToast } from './CustomToast';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { QrCode } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useAuthenticatedMutation } from '@/hooks/customApi';

type User = FunctionReturnType<typeof api.routes.driver.getUser>;

export default function HomeScreenHeader({ user }: { user: User }) {
  const { showToast } = useToast();

  const toggleAvailability = useAuthenticatedMutation(api.routes.driver.toggleAvailability);
  const [genderMatching, setGenderMatching] = useState<boolean>(false);

  if (!user) return;
  return (
    <View>
      <View className="flex-row items-center justify-between gap-3 bg-primary px-4 pb-1.5">
        <View className="flex-1 flex-row items-center justify-end gap-3">
          <ProfileDropdown
            user={user}
            genderMatching={genderMatching}
            setGenderMatching={setGenderMatching}
          />

          <View className="flex-1 items-start">
            <Text className="text-md text-title font-semibold capitalize">{`${user.firstName.toLowerCase()}`}</Text>
            <Text className="text-title/80 text-xs italic">{`${user.driverDetails?.isAvailableForRide ? 'Available' : 'Not Available'}`}</Text>
          </View>
        </View>

        {/* Availability Toggle */}
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
              console.log('error', error);
              showToast({
                type: 'error',
                title: 'Failed',
                description: error.data ?? 'Failed to switch',
              });
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
            <Text className="text-xs font-semibold text-primary">
              {user.driverDetails?.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProfileDropdown({
  user,
  genderMatching,
  setGenderMatching,
}: {
  user: User;
  genderMatching: boolean;
  setGenderMatching: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  if (user === null) return;

  const toggleGenderMatching = useAuthenticatedMutation(api.routes.driver.toggleGenderMatching);

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
            { 'border-red-600': !user.driverDetails?.isAvailableForRide }
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

      <DropdownMenuContent className="native:w-64 elevation-md w-60 rounded-3xl bg-white/95">
        <Animated.View entering={FadeIn.duration(200)}>
          <View className="bg-primary/5 px-4 py-1">
            <Text className="text-menu text-lg font-bold">Menu</Text>
          </View>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild closeOnPress className="py-1">
              <Link href={'/profile'}>
                <View className="flex-row items-center gap-3 px-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <FontAwesome5 name="user" size={18} color={colors.primary} />
                  </View>
                  <Text className="text-menu text-base font-medium">Profile</Text>
                </View>
              </Link>
            </DropdownMenuItem>

            {/* Gender matching switch */}
            <DropdownMenuItem className="py-1">
              <View className="flex-row items-center gap-3 px-2">
                <View className="h-8 w-8 items-center justify-center">
                  {/* <Checkbox checked={genderMatching} onCheckedChange={setGenderMatching}/> */}
                  <Switch checked={genderMatching} onCheckedChange={toggleGenderMatch} />
                </View>
                <Text
                  onPress={() => setGenderMatching((prev) => !prev)}
                  className="text-menu text-base font-medium">
                  Gender Matching
                </Text>
              </View>
            </DropdownMenuItem>

            {user.driverDetails && (
              <DropdownMenuItem asChild closeOnPress className="py-1">
                <Link
                  href={{
                    pathname: '/paymentQrCode',
                    params: { driverId: user.driverDetails._id.toString() },
                  }}>
                  <View className="flex-row items-center gap-3 px-2">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-orange-500/10">
                      <QrCode size={18} color="#f59e0b" strokeWidth={2} />
                    </View>
                    <Text className="text-menu text-base font-medium">Payment QR Code</Text>
                  </View>
                </Link>
              </DropdownMenuItem>
            )}
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
    <View className="flex-row items-center justify-between gap-3 bg-primary px-4 pb-3">
      {back ? (
        <TouchableOpacity
          className="mr-2 flex-row items-center gap-2"
          onPress={() => navigation.goBack()}>
          <MaterialIcons name="keyboard-backspace" size={24} color={'#FFF'} />
          <Text className="text-md font-semibold text-white">
            {options.headerBackTitle ?? 'Back'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="min-w-[72px]" />
      )}

      <Text className="flex-1 text-center text-base font-semibold text-white">
        {options.title ?? ''}
      </Text>
      <View className="w-1/4" />
    </View>
  );
}
