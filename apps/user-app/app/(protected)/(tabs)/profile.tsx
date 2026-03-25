import ErrorScreen from '@/components/ErrorScreen';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Link, Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

export default function Profile() {
  const { userId, signOut } = useAuth();
  const router = useRouter();

  if (!userId) return <ErrorScreen message="User not found" />;
  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? '' });

  if (user === undefined) return <ActivityIndicator />;
  if (user === null) return <Redirect href="/register" />;

  const theme = colorScheme.get();

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <StatusBar
        translucent={false}
        backgroundColor={theme === 'dark' ? '#09090b' : 'black'}
        style={theme === 'dark' ? 'light' : 'dark'}
      />

      {/* Hero Header */}
      <View className="overflow-hidden rounded-b-[40px] bg-primary pb-8 shadow-xl shadow-primary/30">
        {/* Back Button */}
        <TouchableOpacity
          className="mx-5 mt-2 flex-row items-center gap-1.5 self-start"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/');
          }}>
          <MaterialIcons
            name="keyboard-backspace"
            size={20}
            color={theme === 'dark' ? 'dark' : 'white'}
          />
          <Text className="text-sm font-medium text-primary-foreground opacity-90">Back</Text>
        </TouchableOpacity>

        {/* Profile Identity */}
        <View className="mt-6 items-center gap-4">
          <View className="rounded-full border-[3px] border-white/30 p-1 shadow-lg">
            <Avatar alt="Profile pic" className="h-28 w-28">
              <AvatarImage source={require('@/assets/images/react-native-reusables-light.png')} />
              <AvatarFallback className="bg-white/20">
                <Text className="text-2xl font-bold text-primary">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </Text>
              </AvatarFallback>
            </Avatar>
          </View>

          <View className="items-center gap-1">
            <Text className="text-2xl font-bold tracking-wide text-primary-foreground">
              {user?.firstName} {user?.lastName}
            </Text>
            {/* Gender badge */}
            <View className="flex-row items-center gap-1.5 rounded-full bg-primary-foreground/50 px-3 py-1">
              <MaterialIcons
                name={
                  user?.gender === 'Male'
                    ? 'male'
                    : user?.gender === 'Female'
                      ? 'female'
                      : 'transgender'
                }
                size={13}
                color="rgba(255,255,255,0.8)"
              />
              <Text className="text-xs font-medium text-white">{user?.gender}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-6 pb-10 gap-4"
        showsVerticalScrollIndicator={false}>
        {/* Personal Info Card */}
        <View className="overflow-hidden rounded-2xl bg-white shadow-md shadow-slate-200 dark:bg-zinc-900 dark:shadow-none">
          <View className="border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
              Personal Information
            </Text>
          </View>

          {/* DOB */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/30">
              <MaterialIcons name="cake" size={20} color="#9333ea" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                Date of Birth
              </Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800 dark:text-zinc-100">
                {new Date(user?.dob ?? '').toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View className="mx-6 h-px bg-slate-100 dark:bg-zinc-800" />

          {/* Gender */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/30">
              <MaterialIcons name="wc" size={20} color="#ec4899" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                Gender
              </Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800 dark:text-zinc-100">
                {user?.gender}
              </Text>
            </View>
          </View>

          <View className="mx-6 h-px bg-slate-100 dark:bg-zinc-800" />

          {/* Phone */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/30">
              <MaterialIcons name="phone" size={20} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                Phone Number
              </Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800 dark:text-zinc-100">
                {user?.phoneNumber}
              </Text>
            </View>
          </View>
        </View>

        {/* Edit Profile Button */}
        <Link
          asChild
          href={{
            pathname: '/editProfile',
            params: {
              userId: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              dob: user.dob,
              phoneNumber: user.phoneNumber,
              gender: user.gender,
              clerkId: user.clerkId,
            },
          }}>

          <Button variant={'secondary'} onPress={() => router.push('/(protected)/editProfile')}>
            <MaterialIcons name="edit" size={18} color="white" />
            <Text>Edit Profile</Text>
          </Button>

        </Link>

        <Button variant={'destructive'} onPress={async () => {
          await signOut()
          router.replace('/(auth)/signin')
        }}>
          <MaterialIcons name="logout" size={18} color="white" />
          <Text>Logout</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
