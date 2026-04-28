import ErrorScreen from '@/components/ErrorScreen';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { Feather, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import type { Id } from '@tutem/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { ImageBackground, TouchableOpacity, View } from 'react-native';
import LoadingScreen from '@/components/LoadingScreen';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { HorizontalRule } from '@/components/ui/seperator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as ImagePicker from 'expo-image-picker';
import { cn } from '@/lib/utils';
import useThemeColors from '@/hooks/useColorScheme';

const EXPANDED_HEADER_HEIGHT = 300;
const COLLAPSED_HEADER_HEIGHT = 100;
const SCROLL_DISTANCE = EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT;

export default function Profile() {
  const [image, setImage] = useState('');
  const { userId, signOut } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { iconColor, BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor} = useThemeColors();

  const isDark = colorScheme === 'dark';

  const rider = useQuery(api.routes.rider.getRider, { clerkId: userId ?? '' });
  const removeExpoPushToken = useMutation(api.routes.rider.removeExpoPushToken);

  const handleLogout = async (riderId: Id<'rider'> | undefined) => {
    if (riderId !== undefined) await removeExpoPushToken({ riderId });
    await signOut();
    router.replace('/signin');
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
      [0, -150], // Shifted further left to compensate
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -75],
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
      [0, -50], // Shifted less to the right to balance with avatar
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -155],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX }, { translateY }, { scale }],
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

  if (!userId) return <ErrorScreen message="User not found" />;
  if (rider === undefined) return <LoadingScreen message="Loading profile..." />;
  if (rider === null) return <ErrorScreen message="User not found" />;

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      imageStyle={{ opacity: 0.15 }}
      className="flex-1 bg-background">
      <StatusBar style={isDark ? 'dark' : 'light'} backgroundColor={isDark ? '#000' : '#FFF'} />

      {/* Hero Header */}
      <Animated.View
        style={[headerAnimatedStyle, { position: 'absolute', top: 0, left: 0, right: 0 }]}
        className={cn("overflow-hidden bg-primary pt-12 shadow-xl shadow-primary/30", {"bg-primary/75": isDark})}>
        {/* Action Buttons — absolute, won't affect layout */}
        <Animated.View
          style={[badgeOpacityStyle, { position: 'absolute', top: 0, right: 0, zIndex: 10 }]}
          className="flex-row items-center gap-1 pr-4 pt-14">
          <TouchableOpacity
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackgroundColor }}
            onPress={() =>
              router.push({
                pathname: '/editProfile',
                params: {
                  firstName: rider.firstName,
                  lastName: rider?.lastName,
                  dob: rider.dob,
                  phoneNumber: rider.phoneNumber,
                  gender: rider.gender,
                  clerkId: rider?.clerkId,
                },
              })
            }>
            <MaterialIcons name="edit" size={18} color={iconColor} />
          </TouchableOpacity>

          <TouchableOpacity
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackgroundColor }}
            onPress={() => handleLogout(rider.riderDetails?._id)}>
            <MaterialIcons name="logout" size={18} color={iconColor} />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Identity — untouched, parallax works as before */}
        <View className="mt-6">
          <Animated.View style={avatarContainerStyle} className="items-center">
            <View className="rounded-full border-[3px] border-white/30 p-1 shadow-lg">
              <Avatar alt="Profile pic" className="h-28 w-28">
                <AvatarImage
                  source={
                    image
                      ? { uri: image }
                      : rider.profilePictureKey
                        ? { uri: rider.profilePictureKey }
                        : require('@/assets/images/avatar.jpg')
                  }
                />
                <AvatarFallback className="bg-white/20">
                  <Text className="text-2xl font-bold text-primary">
                    {rider.firstName?.[0]}
                    {rider?.lastName?.[0]}
                  </Text>
                </AvatarFallback>
              </Avatar>
              <ImagePickerDialog
                setImageUri={(newImageUri) => handleUploadImage(newImageUri)}
                clerkId={rider.clerkId}
                profilePictureKey={rider.profilePictureKey}
                scrollY={scrollY}
                scrollDistance={SCROLL_DISTANCE}
              />
            </View>
          </Animated.View>

          <Animated.View style={nameContainerStyle} className="items-center gap-1">
            <Text className="text-2xl font-bold tracking-wide text-primary-foreground">
              {rider.firstName} {rider.lastName}
            </Text>
            <Animated.View
              style={badgeOpacityStyle}
              className="flex-row items-center gap-1.5 rounded-full bg-primary-foreground/50 px-3 py-1">
              <MaterialIcons
                name={
                  rider.gender === 'Male'
                    ? 'male'
                    : rider?.gender === 'Female'
                      ? 'female'
                      : 'transgender'
                }
                size={13}
                color="rgba(255,255,255,0.8)"
              />
              <Text className="text-xs font-medium text-white">{rider.gender}</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* information cards */}
      <Animated.ScrollView
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
                  {new Date(rider.dob).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <HorizontalRule className="mx-6" />

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
                  {rider.gender}
                </Text>
              </View>
            </View>

            <HorizontalRule className="mx-6" />
            {/* Gender */}

            <View className="flex-row items-center gap-4 px-6 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/30">
                <MaterialIcons
                  name={rider.riderDetails?.genderMatching ? 'people' : 'public'}
                  size={20}
                  color={rider.riderDetails?.genderMatching ? '#16a34a' : '#ec4899'}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-0.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                  Gender Preference
                </Text>
                <Text className="text-sm font-semibold tracking-wide text-slate-800 dark:text-zinc-100">
                  {rider.riderDetails?.genderMatching
                    ? 'Ride with Same Gender'
                    : 'No Preference (Any)'}
                </Text>
              </View>
            </View>

            <HorizontalRule className="mx-6" />

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
                  {rider.phoneNumber}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </ImageBackground>
  );
}

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
  const uploadProfilePicture = useMutation(api.routes.rider.uploadProfilePicture);
  const removeProfilePictureKey = useMutation(api.routes.rider.removeProfilePictureKey);

  const getPresignedUrl = useAction(api.routes.upload.getPresignedUrl);
  async function processUpload(fileUri: string | undefined, fileKey: string) {
    if (!fileUri || !fileUri.startsWith('file://')) return;

    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const extension = fileUri.split('.').pop() || 'jpg';

      const { url: presignedUrl, key } = await getPresignedUrl({
        key: `${fileKey}-${Date.now()}.${extension}`,
        contentType: blob.type,
      });

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type },
      });
      if (uploadResponse.status < 200 || uploadResponse.status >= 300 || !uploadResponse.ok) {
        throw new Error("Couldn't upload image");
      }
      return key;
    } catch (error) {
      throw new Error('Failed to upload image');
    }
  }
  const handleUpload = async (newImgUri: string) => {
    setIsOpen(false);
    if (newImgUri === '') return;
    setImageUri(newImgUri);
    const profilePictureKey = await processUpload(newImgUri, `profilePicture/${userId}}`);
    await uploadProfilePicture({ clerkId, profilePictureKey });
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
