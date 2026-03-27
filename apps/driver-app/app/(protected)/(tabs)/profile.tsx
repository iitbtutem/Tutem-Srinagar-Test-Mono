import ErrorScreen from '@/components/ErrorScreen';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import React from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';

export default function Profile() {
  const { userId, signOut } = useAuth();
  const router = useRouter();

  // const { colorScheme } = useColorScheme();
  // const isDark = colorScheme === 'dark';

  const theme = colorScheme.get() ?? 'dark';

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/signin');
  };

  if (!userId) return <ErrorScreen message="User not found" />;
  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? '' });
  const vehicle = useQuery(
    api.routes.vehicle.getVehicleByUserId,
    user?._id ? { userId: user._id } : 'skip'
  );

  if (user === undefined) return <ActivityIndicator />;
  if (user === null) return <ErrorScreen message="User not found" />;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <StatusBar
        style={theme === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme === 'dark' ? '#000' : '#FFF'}
      />

      {/* Hero Header */}
      <View className="overflow-hidden rounded-b-[40px] bg-primary pb-8 shadow-xl shadow-primary/30">
        {/* Back Button */}
        <View className="mx-5 mt-2 flex-row items-center justify-end">

          {/* Edit and logout user */}
          <View className="flex-row items-center gap-4 pt-2">
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/editProfile',
                  params: {
                    userId: user?._id,
                    firstName: user?.firstName,
                    lastName: user?.lastName,
                    dob: user?.dob,
                    phoneNumber: user?.phoneNumber,
                    licenseNumber: user?.licenseNumber ?? '',
                    gender: user?.gender,
                    organizationId: user?.organizationId ?? '',
                    clerkId: user?.clerkId,
                  },
                })
              }>
              <MaterialIcons
                name="edit"
                size={22}
                color={theme === 'dark' ? '#000000' : '#FFFFFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout}>
              <MaterialIcons
                name="logout"
                size={22}
                color={theme === 'dark' ? '#000000' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Identity */}
        <View className="mt-6 items-center gap-4">
          <View className="rounded-full border-[3px] border-white/30 p-1 shadow-lg">
            <Avatar alt="Profile pic" className="h-28 w-28">
              <AvatarImage source={require('@/assets/images/avatar.jpg')} />
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

        {/* Professional Info Card */}
        <View className="overflow-hidden rounded-2xl bg-white shadow-md shadow-slate-200 dark:bg-zinc-900 dark:shadow-none">
          <View className="border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
              Professional Information
            </Text>
          </View>

          {/* License Number */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
              <MaterialIcons name="badge" size={20} color="#2563eb" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                License Number
              </Text>
              <Text className="font-mono text-sm font-semibold tracking-wide text-slate-800 dark:text-zinc-100">
                {user?.licenseNumber}
              </Text>
            </View>
          </View>

          <View className="mx-6 h-px bg-slate-100 dark:bg-zinc-800" />

          {/* Organization */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/30">
              <MaterialIcons name="corporate-fare" size={20} color="#ea580c" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                Organization
              </Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800 dark:text-zinc-100">
                {user?.organization?.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle Section */}
        <View className="overflow-hidden rounded-2xl bg-white shadow-md shadow-slate-200 dark:bg-zinc-900 dark:shadow-none">
          <View className="border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
              Registered Vehicle
            </Text>
          </View>

          {vehicle ? (
            <>
              {/* Compact vehicle details */}
              <View className="gap-3 px-6 py-4">
                {/* Model + Reg Number Row */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
                      <MaterialIcons
                        name="directions-car"
                        size={20}
                        color={theme === 'dark' ? '#818cf8' : '#4f46e5'}
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                        {vehicle.model}
                      </Text>
                      <Text className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {vehicle.registrationNumber}
                      </Text>
                    </View>
                  </View>
                  <View className="rounded-lg bg-emerald-50 px-2.5 py-1 dark:bg-emerald-900/30">
                    <Text className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      Active
                    </Text>
                  </View>
                </View>

                <View className="mx-1 h-px bg-slate-100 dark:bg-zinc-800" />

                {/* Detail chips row */}
                <View className="flex-row flex-wrap gap-2">
                  <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-zinc-800">
                    <MaterialIcons
                      name="local-gas-station"
                      size={13}
                      color={theme === 'dark' ? '#a1a1aa' : '#64748b'}
                    />
                    <Text className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      {vehicle.fuelType}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-zinc-800">
                    <MaterialIcons
                      name="people"
                      size={13}
                      color={theme === 'dark' ? '#a1a1aa' : '#64748b'}
                    />
                    <Text className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      {vehicle.seatingCapacity} seats
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-zinc-800">
                    <MaterialIcons
                      name="category"
                      size={13}
                      color={theme === 'dark' ? '#a1a1aa' : '#64748b'}
                    />
                    <Text className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      {vehicle.type}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-zinc-800">
                    <MaterialIcons
                      name="star"
                      size={13}
                      color={theme === 'dark' ? '#a1a1aa' : '#64748b'}
                    />
                    <Text className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      {vehicle.class}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-zinc-800">
                    <MaterialIcons
                      name="palette"
                      size={13}
                      color={theme === 'dark' ? '#a1a1aa' : '#64748b'}
                    />
                    <Text className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      {vehicle.color}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Edit link */}
              <View className="pb-3">
                <Button
                  className="w-3/4 flex-row items-center justify-center gap-2 self-center"
                  onPress={() =>
                    router.push({
                      pathname: '/(protected)/editVehicle',
                      params: {
                        vehicleId: vehicle._id,
                        registrationNumber: vehicle.registrationNumber,
                        type: vehicle.type,
                        model: vehicle.model,
                        fuelType: vehicle.fuelType,
                        color: vehicle.color,
                        seatingCapacity: String(vehicle.seatingCapacity),
                        vehicleClass: vehicle.class,
                      },
                    })
                  }>
                  <MaterialIcons
                    name="edit"
                    size={15}
                    color={theme === 'dark' ? 'black' : 'white'}
                  />
                  <Text className="text-sm font-semibold text-white dark:text-black">
                    Edit Vehicle Details
                  </Text>
                </Button>
              </View>
            </>
          ) : (
            <View className="items-center gap-3 px-6 py-6">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
                <MaterialIcons
                  name="directions-car"
                  size={24}
                  color={theme === 'dark' ? '#71717a' : '#94a3b8'}
                />
              </View>
              <Text className="text-center text-sm text-slate-400 dark:text-zinc-500">
                No vehicle registered yet
              </Text>
              <Button
                className="flex-row items-center gap-2 rounded-xl bg-primary"
                onPress={() => router.push('/(protected)/createVehicle')}>
                <MaterialIcons name="add" size={18} color={theme === 'dark' ? '#000' : '#fff'} />
                <Text className="text-sm font-bold text-primary-foreground">Register Vehicle</Text>
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
