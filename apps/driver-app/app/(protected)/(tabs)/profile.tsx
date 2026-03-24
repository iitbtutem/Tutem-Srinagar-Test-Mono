import ErrorScreen from '@/components/ErrorScreen';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SelectSeparator } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const { userId } = useAuth();
  const router = useRouter();

  if (!userId) return <ErrorScreen message="User not found" />;
  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? '' });

  if (user === undefined) return <ActivityIndicator />;

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar translucent backgroundColor="transparent" style="light" />

      {/* Hero Header */}
      <View className="overflow-hidden rounded-b-[40px] bg-primary pb-8 shadow-xl shadow-primary/30">
        <SafeAreaView>
          {/* Back Button */}
          <TouchableOpacity
            className="mx-5 mt-2 flex-row items-center gap-1.5 self-start"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.push('/');
            }}>
            <MaterialIcons name="keyboard-backspace" size={20} color="white" />
            <Text className="text-sm font-medium text-white opacity-90">Back</Text>
          </TouchableOpacity>

          {/* Profile Identity */}
          <View className="mt-6 items-center gap-4">
            <View className="rounded-full border-[3px] border-white/30 p-1 shadow-lg">
              <Avatar alt="Profile pic" className="h-28 w-28">
                <AvatarImage source={require('@/assets/images/avatar.jpg')} />
                <AvatarFallback className="bg-white/20">
                  <Text className="text-2xl font-bold text-white">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </Text>
                </AvatarFallback>
              </Avatar>
            </View>

            <View className="items-center gap-1">
              <Text className="text-2xl font-bold tracking-wide text-white">
                {user?.firstName} {user?.lastName}
              </Text>
              {/* Gender badge */}
              <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
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
                <Text className="text-xs font-medium text-white/80">{user?.gender}</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-6 pb-10 gap-4"
        showsVerticalScrollIndicator={false}>
        {/* Personal Info Card */}
        <View className="overflow-hidden rounded-2xl bg-white shadow-md shadow-slate-200">
          <View className="border-b border-slate-100 px-6 py-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Personal Information
            </Text>
          </View>

          {/* DOB */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <MaterialIcons name="cake" size={20} color="#9333ea" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400">Date of Birth</Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800">
                {new Date(user?.dob ?? '').toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View className="mx-6 h-px bg-slate-100" />

          {/* Gender */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-50">
              <MaterialIcons name="wc" size={20} color="#ec4899" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400">Gender</Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800">
                {user?.gender}
              </Text>
            </View>
          </View>

          <View className="mx-6 h-px bg-slate-100" />

          {/* Phone */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <MaterialIcons name="phone" size={20} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400">Phone Number</Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800">
                {user?.phoneNumber}
              </Text>
            </View>
          </View>
        </View>

        {/* Professional Info Card */}
        <View className="overflow-hidden rounded-2xl bg-white shadow-md shadow-slate-200">
          <View className="border-b border-slate-100 px-6 py-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Professional Information
            </Text>
          </View>

          {/* License Number */}
          <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <MaterialIcons name="badge" size={20} color="#2563eb" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400">License Number</Text>
              <Text className="font-mono text-sm font-semibold tracking-wide text-slate-800">
                {user?.licenseNumber}
              </Text>
            </View>
          </View>

          <View className="mx-6 h-px bg-slate-100" />

          {/* Organization ID */}
          {/* <View className="flex-row items-center gap-4 px-6 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <MaterialIcons name="corporate-fare" size={20} color="#ea580c" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs font-medium text-slate-400">Organization</Text>
              <Text className="text-sm font-semibold tracking-wide text-slate-800">
                {user?.organizationId}
              </Text>
            </View>
          </View> */}
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 shadow-md shadow-primary/25">
          <MaterialIcons name="edit" size={18} color="white" />
          <Text className="text-sm font-semibold text-white">Edit Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
