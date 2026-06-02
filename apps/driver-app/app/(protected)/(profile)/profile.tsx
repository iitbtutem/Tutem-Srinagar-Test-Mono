import ErrorScreen from '@/components/ErrorScreen';
import { useAuth } from '@clerk/expo';
import { Feather, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import type { Id } from '@tutem/api';
import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import LoadingScreen from '@/components/LoadingScreen';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Image } from 'react-native';
import { cn } from '@/lib/utils';
import {
  HorizontalRule,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Text,
} from '@tutem/ui';
import * as ImagePicker from 'expo-image-picker';
import { VERIFICATION_CONFIG } from '@/constants/colors';
import useThemeColors from '@/hooks/useColorScheme';
import { useToast } from '@/components/CustomToast';
import { useFileUpload } from '@/hooks/useFileUpload';

const EXPANDED_HEADER_HEIGHT = 240;
const COLLAPSED_HEADER_HEIGHT = 60;
const SCROLL_DISTANCE = EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT;

export default function Profile() {
  const [image, setImage] = useState('');
  const { userId, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor } =
    useThemeColors();

  const snapPoints = useMemo(() => ['50%', '80%'], []);

  const licenseBottomSheetRef = useRef<BottomSheet>(null);
  const vehicleBottomSheetRef = useRef<BottomSheet>(null);

  const driver = useQuery(api.routes.driver.getUser, { clerkId: userId ?? '' });
  const vehicle = useQuery(
    api.routes.vehicle.getVehicleByDriverId,
    driver && driver.driverDetails?._id ? { driverId: driver.driverDetails._id } : 'skip'
  );
  const logout = useMutation(api.routes.driver.logout);

  const handleLogout = async (driverId: Id<'driver'> | undefined) => {
    try {
      if (driverId !== undefined) await logout({ driverId });
      await signOut();
      router.replace('/signin');
    } catch (error) {
      console.error('Error during logout:', error);
      showToast({
        type: 'error',
        title: 'Logout Failed',
        description: 'An error occurred while logging out. Please try again.',
        position: 'bottom',
      });
    }
  };

  const handleUploadImage = (imageUri: string): void => {
    setImage(imageUri);
  };

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [EXPANDED_HEADER_HEIGHT, COLLAPSED_HEADER_HEIGHT],
      Extrapolation.CLAMP
    );

    const borderRadius = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [40, 0],
      Extrapolation.CLAMP
    );

    return {
      height,
      borderBottomLeftRadius: borderRadius,
      borderBottomRightRadius: borderRadius,
      zIndex: 10,
    };
  });

  const avatarContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, SCROLL_DISTANCE], [1, 0.35], Extrapolation.CLAMP);

    const translateX = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -140], // Shifted further left to compensate
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -65],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  const nameContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, SCROLL_DISTANCE], [1, 0.8], Extrapolation.CLAMP);

    const translateX = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -75], // Shifted less to the right to balance with avatar
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -145],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  const actionButtonStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE / 2],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      pointerEvents: opacity < 0.5 ? 'none' : 'auto',
    };
  });

  const badgeOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE / 2],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
    };
  });

  if (!userId) return <ErrorScreen message="Account not found" />;
  if (driver === undefined) return <LoadingScreen message="Loading profile…" />;
  if (driver === null || driver.driverDetails === null)
    return <ErrorScreen message="Account not found" />;

  const licenseVerification =
    VERIFICATION_CONFIG[driver.driverDetails?.isLicenseVerified ?? 'Pending'];
  const vehicleVerification = VERIFICATION_CONFIG[vehicle?.isVerified || 'Pending'];

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Hero Header */}
      <Animated.View
        style={[headerAnimatedStyle, { position: 'absolute', width: '100%' }]}
        className="overflow-hidden bg-primary">
        {/* Action Buttons — absolute, won't affect layout */}
        <Animated.View
          style={[actionButtonStyle, { position: 'absolute', top: 0, zIndex: 1 }]}
          className="w-full flex-row items-center justify-between px-4 mt-2">
          <TouchableOpacity
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackgroundColor }}
            onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>

          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: iconBackgroundColor }}
              onPress={() =>
                router.push({
                  pathname: '/editProfile',
                  params: {
                    firstName: driver.firstName,
                    lastName: driver?.lastName,
                    dob: driver.dob,
                    phoneNumber: driver.phoneNumber,
                    licenseNumber: driver.driverDetails?.licenseNumber,
                    gender: driver.gender,
                    organizationId: driver.driverDetails?.organizationId,
                    clerkId: driver.clerkId,
                  },
                })
              }>
              <MaterialIcons name="edit" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: iconBackgroundColor }}
              onPress={() => handleLogout(driver.driverDetails?._id)}>
              <MaterialIcons name="logout" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Profile Identity — untouched, parallax works as before */}
        <View className="mt-6">
          <Animated.View style={avatarContainerStyle} className="items-center">
            <View className="rounded-full border-[3px] border-white/90 p-1 shadow-lg">
              <Avatar alt="Profile pic" className="h-28 w-28">
                <AvatarImage
                  source={
                    image
                      ? { uri: image }
                      : driver.profilePictureKey
                        ? { uri: driver.profilePictureKey }
                        : require('@/assets/images/avatar.jpg')
                  }
                />
                <AvatarFallback className="bg-white/20">
                  <Text className="text-2xl font-bold text-primary">
                    {driver.firstName?.[0]}
                    {driver?.lastName?.[0]}
                  </Text>
                </AvatarFallback>
              </Avatar>
              <ImagePickerDialog
                setImageUri={(newImageUri) => handleUploadImage(newImageUri)}
                clerkId={driver.clerkId}
                profilePictureKey={driver.profilePictureKey}
                scrollY={scrollY}
                scrollDistance={SCROLL_DISTANCE}
              />
            </View>
          </Animated.View>

          <Animated.View style={nameContainerStyle} className="ms-4 items-center gap-1">
            <Text className="text-2xl font-bold tracking-wide text-primary-foreground">
              {driver.firstName} {driver.lastName}
            </Text>
            <Animated.View
              style={badgeOpacityStyle}
              className="flex-row items-center gap-1.5 rounded-full bg-primary-foreground/50 px-3 py-1">
              <MaterialIcons
                name={
                  driver.gender === 'Male'
                    ? 'male'
                    : driver?.gender === 'Female'
                      ? 'female'
                      : 'transgender'
                }
                size={13}
                color="rgba(255,255,255,0.8)"
              />
              <Text className="text-xs font-medium text-white">{driver.gender}</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* information cards */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: EXPANDED_HEADER_HEIGHT + 24, // Added extra padding
          paddingBottom: 40,
        }}>
        <View className="gap-4">
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
                  {new Date(driver.dob).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <HorizontalRule className="mx-6" />

            {/* Gender */}
            <View className="flex-row items-center gap-4 px-6 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-50">
                <MaterialIcons name="wc" size={20} color="#ec4899" />
              </View>
              <View className="flex-1">
                <Text className="mb-0.5 text-xs font-medium text-slate-400">Gender</Text>
                <Text className="text-sm font-semibold tracking-wide text-slate-800">
                  {driver.gender}
                </Text>
              </View>
            </View>

            <HorizontalRule className="mx-6" />

            {/* Phone */}
            <View className="flex-row items-center gap-4 px-6 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <MaterialIcons name="phone" size={20} color="#16a34a" />
              </View>
              <View className="flex-1">
                <Text className="mb-0.5 text-xs font-medium text-slate-400">Phone Number</Text>
                <Text className="text-sm font-semibold tracking-wide text-slate-800">
                  {driver.phoneNumber}
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
            <View className="px-6 py-4">
              <TouchableOpacity
                className="flex-row items-center gap-4"
                onPress={() => {
                  licenseBottomSheetRef.current?.snapToIndex(0);
                }}>
                <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                  <Feather name="credit-card" size={14} color="#2563eb" />
                </View>
                <View className="flex-1">
                  <Text className="mb-0.5 text-xs font-medium text-slate-400">License Number</Text>
                  <Text className="font-mono text-sm font-semibold tracking-wide text-slate-800">
                    {driver.driverDetails?.licenseNumber}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <HorizontalRule className="mx-6" />

            {/* Organization */}
            <View className="flex-row items-center gap-4 px-6 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-50">
                <MaterialIcons name="corporate-fare" size={20} color="#ea580c" />
              </View>
              <View className="flex-1">
                <Text className="mb-0.5 text-xs font-medium text-slate-400">Organization</Text>
                <Text className="text-sm font-semibold tracking-wide text-slate-800">
                  {driver.driverDetails?.organization?.name}
                </Text>
              </View>
            </View>
          </View>

          {/* Vehicle Section */}
          <View className="overflow-hidden rounded-2xl bg-white shadow-md shadow-slate-200">
            <View className="border-b border-slate-100 px-6 py-4">
              <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Registered Vehicle
              </Text>
            </View>

            {vehicle ? (
              <>
                {/* Compact vehicle details */}
                <View className="gap-3 px-6 py-4">
                  {/* Model + Reg Number Row */}
                  <TouchableOpacity
                    onPress={() => {
                      vehicleBottomSheetRef.current?.snapToIndex(0);
                    }}
                    className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                        <MaterialIcons name="directions-car" size={20} color="#4f46e5" />
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-slate-800">{vehicle.model}</Text>
                        <Text className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400">
                          {vehicle.registrationNumber}
                        </Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={16} color="#94a3b8" />
                  </TouchableOpacity>

                  <View className="mx-1 h-px bg-slate-100" />

                  {/* Detail chips row */}
                  <View className="flex-row flex-wrap gap-2">
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5">
                      <MaterialIcons name="local-gas-station" size={13} color={'#64748b'} />
                      <Text className="text-xs font-semibold text-slate-600">
                        {vehicle.fuelType}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5">
                      <MaterialIcons name="people" size={13} color={'#64748b'} />
                      <Text className="text-xs font-semibold text-slate-600">
                        {vehicle.seatingCapacity} seats
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5">
                      <MaterialIcons name="category" size={13} color={'#64748b'} />
                      <Text className="text-xs font-semibold text-slate-600">{vehicle.type}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5">
                      <MaterialIcons name="star" size={13} color={'#64748b'} />
                      <Text className="text-xs font-semibold text-slate-600">{vehicle.class}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5">
                      <MaterialIcons name="palette" size={13} color={'#64748b'} />
                      <Text className="text-xs font-semibold text-slate-600">{vehicle.color}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View className="items-center gap-3 px-6 py-6">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <MaterialIcons name="directions-car" size={24} color={'#94a3b8'} />
                </View>
                <Text className="text-center text-sm text-slate-400">
                  No vehicle registered yet
                </Text>
                <Button
                  className="flex-row items-center gap-2 rounded-xl bg-primary"
                  onPress={() => router.push('/createVehicle')}>
                  <MaterialIcons name="add" size={18} color={'#fff'} />
                  <Text className="text-sm font-bold text-primary-foreground">
                    Register Vehicle
                  </Text>
                </Button>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      <BottomSheet
        ref={licenseBottomSheetRef}
        index={-1}
        animationConfigs={{ duration: 450 }}
        snapPoints={
          driver.driverDetails?.licenseImageFrontKey || driver.driverDetails?.licenseImageBackKey
            ? ['50%', '80%']
            : ['30%']
        }
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor }}
        backdropComponent={(props: any) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}>
        <BottomSheetView className="pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between gap-3 border-b border-zinc-100 px-6 pb-3 pt-2">
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                <Feather name="credit-card" size={16} color="#fff" />
              </View>
              <View>
                <Text className="text-base font-bold tracking-tight text-slate-900">
                  Driver's License
                </Text>
                {/* Verified badge */}
                <View
                  style={{ backgroundColor: licenseVerification.color + '30' }}
                  className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1">
                  <Feather
                    name={licenseVerification.icon as any}
                    size={11}
                    color={licenseVerification.color}
                  />
                  <Text
                    style={{ color: licenseVerification.color }}
                    className="text-xs font-semibold">
                    {licenseVerification.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Edit button */}
            {(driver.driverDetails?.organization?.canDriverEditLicesnse ||
              driver.driverDetails?.isLicenseVerified !== 'Verified') && (
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: '/editLicense',
                    params: {
                      licenseNumber: driver.driverDetails?.licenseNumber,
                      driverId: driver.driverDetails?._id,
                      requiresLicenseImg: driver.driverDetails?.organization
                        ?.isLicenseVerficationRequired
                        ? 'true'
                        : 'false',
                    },
                  });
                  licenseBottomSheetRef.current?.close();
                }}
                className="h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                <Feather name="edit-2" size={14} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>

          {/* License Number */}
          <View className="mx-6 mt-3 flex-row items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5">
            <View>
              <Text className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                License No.
              </Text>
              <Text className="font-mono text-base font-bold tracking-wider text-slate-800">
                {driver.driverDetails?.licenseNumber ?? '—'}
              </Text>
            </View>
            <View className="bg-blue-5 h-8 w-8 items-center justify-center rounded-lg">
              <Feather name="hash" size={14} color="#3b82f6" />
            </View>
          </View>

          {/* Images */}
          {driver.driverDetails?.organization?.isLicenseVerficationRequired && (
            <View className="mt-3 gap-2 px-6">
              {driver.driverDetails?.licenseImageFrontKey && (
                <LicenseImageCard
                  label="Front Side"
                  uri={driver.driverDetails?.licenseImageFrontKey}
                />
              )}
              {driver.driverDetails?.licenseImageBackKey && (
                <LicenseImageCard
                  label="Back Side"
                  uri={driver.driverDetails?.licenseImageBackKey}
                />
              )}
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* Registered Vehicle Bottomsheet */}

      {vehicle && (
        <BottomSheet
          ref={vehicleBottomSheetRef}
          index={-1}
          animationConfigs={{ duration: 450 }}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor }}
          handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor }}
          backdropComponent={(props: any) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}>
          <BottomSheetView className="pb-8">
            {/* Header */}
            <View className="flex-row items-center justify-between gap-3 border-b border-zinc-100 px-6 pb-3 pt-2">
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                  <Feather name="credit-card" size={16} color="#fff" />
                </View>
                <View>
                  <Text className="text-base font-bold tracking-tight text-slate-900">
                    Vehicle Details
                  </Text>
                  {/* Verified badge */}
                  <View
                    style={{ backgroundColor: vehicleVerification.color + '30' }}
                    className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1">
                    <Feather
                      name={vehicleVerification.icon as any}
                      size={11}
                      color={vehicleVerification.color}
                    />
                    <Text
                      style={{ color: vehicleVerification.color }}
                      className="text-xs font-semibold">
                      {vehicleVerification.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Edit button */}
              {(driver.driverDetails?.organization?.canDriverEditVehicle ||
                vehicle.isVerified !== 'Verified') && (
                <TouchableOpacity
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: iconBackgroundColor }}
                  onPress={() => {
                    router.push({
                      pathname: '/editVehicle',
                      params: {
                        vehicleId: vehicle._id,
                        registrationNumber: vehicle.registrationNumber,
                        type: vehicle.type,
                        model: vehicle.model,
                        fuelType: vehicle.fuelType,
                        color: vehicle.color,
                        seatingCapacity: String(vehicle.seatingCapacity),
                        vehicleClass: vehicle.class,
                        rcImageKey: vehicle.rcImageKey,
                        isRcRequired: driver.driverDetails?.organization
                          ?.isVehicleRCVerificationRequired
                          ? 'true'
                          : 'false',
                        isInsuranceImageRequired: driver.driverDetails?.organization
                          ?.isVehicleInsuranceImageRequired
                          ? 'true'
                          : 'false',
                      },
                    });
                    vehicleBottomSheetRef.current?.close();
                  }}>
                  <MaterialIcons name="edit" size={18} color={'black'} />
                </TouchableOpacity>
              )}
            </View>

            {/* License Number */}
            <View className="mx-6 mt-3 flex-row items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5">
              <View>
                <Text className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Registration Number
                </Text>
                <Text className="font-mono text-base font-bold tracking-wider text-slate-800">
                  {vehicle?.registrationNumber ?? '—'}
                </Text>
              </View>
              <View className="bg-blue-5 h-8 w-8 items-center justify-center rounded-lg">
                <Feather name="hash" size={14} color="#3b82f6" />
              </View>
            </View>

            {/* Images */}
            <View className="mt-3 gap-2 px-6">
              <ImageCard label="RC Image" uri={vehicle?.rcImageKey} />
              <ImageCard label="Insurance Image" uri={vehicle?.insuranceImageKey} />
            </View>
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

const LicenseImageCard = ({ label, uri }: { label: string; uri?: string | null }) => {
  const [errored, setErrored] = useState(false);
  const showFallback = !uri || errored;
  console.log("uri: ", uri);

  return (
    <View className="overflow-hidden rounded-2xl border border-zinc-200">
      {/* Card label bar */}
      <View className="flex-row items-center gap-2 bg-zinc-100 px-3.5 py-2">
        <Feather
          name={label === 'Front Side' ? 'maximize' : 'minimize'}
          size={11}
          color={'#9ca3af'}
        />
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </Text>
      </View>

      {/* Image or fallback */}
      <View className="h-44 w-full items-center justify-center bg-zinc-50/60">
        {showFallback ? (
          <View className="items-center gap-2">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-zinc-200">
              <Feather name="image" size={20} color={'#9ca3af'} />
            </View>
            <Text className="text-xs text-slate-400">
              {!uri ? 'Image not available' : 'Failed to load'}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri }}
            className="h-full w-full"
            resizeMode="cover"
            onError={() => setErrored(true)}
          />
        )}
      </View>
    </View>
  );
};

const ImageCard = ({ label, uri }: { label: string; uri?: string | null }) => {
  const [errored, setErrored] = useState(false);
  const showFallback = !uri || errored;

  return (
    <View className="overflow-hidden rounded-2xl border border-zinc-200">
      {/* Card label bar */}
      <View className="flex-row items-center gap-2 bg-zinc-100 px-3.5 py-2">
        <Feather
          name={label === 'Front Side' ? 'maximize' : 'minimize'}
          size={11}
          color="#9ca3af"
        />
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </Text>
      </View>

      {/* Image or fallback */}
      <View className="h-44 w-full items-center justify-center bg-zinc-50/60">
        {showFallback ? (
          <View className="items-center gap-2">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-zinc-200">
              <Feather name="image" size={20} color="#9ca3af" />
            </View>
            <Text className="text-xs text-slate-400">
              {!uri ? 'Image not available' : 'Failed to load'}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri }}
            className="h-full w-full"
            resizeMode="cover"
            onError={() => setErrored(true)}
          />
        )}
      </View>
    </View>
  );
};

function ImagePickerDialog({
  clerkId,
  profilePictureKey,
  setImageUri,
  scrollY,
  scrollDistance,
}: {
  clerkId: string;
  profilePictureKey: string | undefined;
  setImageUri: (uri: string) => void;
  scrollY: SharedValue<number>;
  scrollDistance: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { userId } = useAuth();

  const { uploadFile } = useFileUpload();
  const uploadProfilePicture = useMutation(api.routes.driver.uploadProfilePicture);
  const removeProfilePictureKey = useMutation(api.routes.driver.removeProfilePictureKey);

  const handleUpload = async (newImgUri: string) => {
    setIsOpen(false);
    try {
      if (newImgUri === '') return;
      setImageUri(newImgUri);
      const profilePictureKey = await uploadFile(newImgUri, `profilePicture/${userId}}`);
      await uploadProfilePicture({ clerkId, profilePictureKey });
    } catch (error) {
      console.log('Error uploading profile picture:', error);
    }
  };

  const handleDelete = async () => {
    setIsOpen(false);
    if (profilePictureKey === undefined) return;
    await removeProfilePictureKey({ clerkId });
  };

  const uploadBtnOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, scrollDistance / 2],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Animated.View style={uploadBtnOpacity} className="absolute -bottom-1 -right-1">
        <DialogTrigger asChild>
          <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-teal-800">
            <Feather name="camera" size={20} color="white" />
          </TouchableOpacity>
        </DialogTrigger>
      </Animated.View>
      <DialogContent>
        <DialogTitle>
          <Text className="text-lg text-primary">Choose an option</Text>
        </DialogTitle>
        <DialogHeader className="items-center">
          <View className="w-11/12 flex-row justify-around">
            <TouchableOpacity
              onPress={async () => {
                const result = await ImagePicker.launchCameraAsync({ quality: 0.3 });
                if (result.canceled) return;
                handleUpload(result.assets[0].uri);
              }}>
              <Feather name="camera" size={30} color="orange" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  allowsMultipleSelection: false,
                  quality: 0.3,
                });
                if (result.canceled) return;
                handleUpload(result.assets[0].uri);
              }}>
              <FontAwesome name="photo" size={30} color="orange" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete}>
              <MaterialIcons name="delete-outline" size={30} color="red" />
            </TouchableOpacity>
          </View>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
