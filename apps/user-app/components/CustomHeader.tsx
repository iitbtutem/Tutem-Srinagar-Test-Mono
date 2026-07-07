import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { FunctionReturnType } from 'convex/server';
import { api } from '@tutem/api';
import { useAuthUser } from '@/hooks/useAuthUser';
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
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { colors } from '@/constants/colors';

type User = FunctionReturnType<typeof api.routes.rider.getRider>;

export function HomeScreenHeader({ user }: { user: User }) {
  if (!user) return null;

  return (
    <View className="rounded-br-2xl pb-2">
      <View
        className="self-start rounded-br-2xl bg-card px-3"
        style={{
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowRadius: 3.84,

          elevation: 6,
        }}>
        <ProfileDropdown user={user} />
      </View>
    </View>
  );
}

function ProfileDropdown({ user }: { user: User }) {
  const { signOut } = useAuthUser();

  const handleLogout = async () => {
    if (
      user === undefined ||
      user?.riderDetails === undefined ||
      user.riderDetails?._id === undefined
    )
      return;

    await signOut();
    router.replace('/(auth)/signin');
  };

  if (user === null) return;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity className="flex-row items-center gap-3 py-2">
          <View className="rounded-full border-2 border-green-600 bg-white/60">
            <Avatar alt="Profile pic" className="h-9 w-9">
              <AvatarImage source={{ uri: user.profilePictureKey }} />
              <AvatarFallback className="bg-white/20">
                <Text className="text-2xl font-bold text-primary">
                  {!user.profilePictureKey ? user.firstName[0]?.toUpperCase() : 'D'}
                </Text>
              </AvatarFallback>
            </Avatar>
          </View>
          <View>
            <Text className="text-title text-sm font-semibold">Hello</Text>
            <Text className="text-md text-title font-semibold">{`${user.firstName} ${user.lastName}`}</Text>
          </View>
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
