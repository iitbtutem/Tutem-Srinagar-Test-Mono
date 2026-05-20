import { FontAwesome5, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';
import { FunctionReturnType } from 'convex/server';
import { api } from '@tutem/api';
import { useAuth } from '@clerk/expo';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Link, router } from 'expo-router';
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
} from '@tutem/ui';
import { useMutation } from 'convex/react';
import { useColorScheme } from 'nativewind';
import useThemeColors from '@/hooks/useColorScheme';

type User = FunctionReturnType<typeof api.routes.rider.getRider>;
type Props = {
  navigation: any;
  options: any;
  back?: any;
  user: User;
};

export default function CustomHeader({ user }: Props) {
  const toggleGenderMatching = useMutation(api.routes.rider.toggleGenderMatching);
  
  const { iconColor } = useThemeColors();
  const {colorScheme}= useColorScheme();
  const isDark = colorScheme === "dark";
  
  if (!user) return;

  const toggleGenderMatch = async () => {
    if (user.riderDetails === null) return;
    await toggleGenderMatching({ id: user.riderDetails?._id });
  };

  return (
    <SafeAreaView className="bg-primary-background flex-row items-start justify-between gap-3 bg-cyan-500 px-4">
      {/* Gender matching toggle */}
      <View className='mt-1'>
        <TouchableOpacity
        activeOpacity={0.8}
        className={cn('flex-row items-center gap-2 rounded-2xl px-2.5 py-1.5', {
          'bg-green-100': user.riderDetails?.genderMatching,
          'bg-red-100': !user.riderDetails?.genderMatching,
        })}
        onPress={toggleGenderMatch}>
        <View
          className={cn('h-7 w-7 items-center justify-center rounded-full', {
            'bg-green-500': user.riderDetails?.genderMatching,
            'bg-red-600': !user.riderDetails?.genderMatching,
          })}>
          <MaterialCommunityIcons
            name={user.gender === 'Male' ? 'gender-male' : 'gender-female'}
            size={16}
            color="white"
          />
        </View>

        <View>
          <Text className="text-[10px] text-gray-500">Gender</Text>
          <Text className={cn("text-xs font-semibold text-primary", {"text-black": isDark})}>
            {user.riderDetails?.genderMatching ? 'Match' : 'Any'}
          </Text>
        </View>
      </TouchableOpacity>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="items-end">
          <Text className="text-md text-title font-semibold">{`${user.firstName} ${user.lastName}`}</Text>
          <View className="flex-row items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1">
            <MaterialIcons
              name={
                user.gender === 'Male'
                  ? 'male'
                  : user.gender === 'Female'
                    ? 'female'
                    : 'transgender'
              }
              size={13}
              color="rgba(255,255,255,0.8)"
            />
            <Text className="text-xs font-medium text-white">
              {user.gender}
            </Text>
          </View>
        </View>
        <ProfileDropdown user={user} isDark={isDark} />
      </View>
    </SafeAreaView>
  );
}

export function HeaderGreeting({ user }: { user: User }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (!user) return null;

  return (
    <View 
      className="px-3 py-2 rounded-br-2xl bg-card self-start"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 5,
      }}
    >
      <View className="flex-row items-center gap-3 rounded-br-2xl">
        <ProfileDropdown user={user} isDark={isDark} />
        <View>
          <Text className="text-sm text-title font-semibold">Hello</Text>
          <Text className="text-md text-title font-semibold">{`${user.firstName} ${user.lastName}`}</Text>
        </View>
      </View>
    </View>
  );
}

function ProfileDropdown({ user, isDark }: { user: User , isDark: boolean}) {
  const { signOut } = useAuth();
  const logout = useMutation(api.routes.rider.logout);

  const { iconColor } = useThemeColors();
  const handleLogout = async () => {
    if (
      user === undefined ||
      user?.riderDetails === undefined ||
      user.riderDetails?._id === undefined
    )
      return;

    const riderId = user.riderDetails._id;

    await logout({ riderId });
    await signOut();
    router.replace('/(auth)/signin');
  };

  if (user === null) return;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity className={cn("rounded-full border-2 border-green-600 bg-white/60",{"bg-blue-600/60": isDark})}>
          <Avatar alt="Profile pic" className="h-9 w-9">
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
          <View className="px-4 py-2">
            <Text className="text-lg font-bold text-primary">Menu</Text>
          </View>

          <DropdownMenuSeparator />
          {/* <DropdownMenuLabel className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Settings
          </DropdownMenuLabel> */}

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
