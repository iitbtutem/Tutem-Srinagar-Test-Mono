import ErrorScreen from '@/components/ErrorScreen';
import { useAuth } from '@/hooks/useAuth';
import { useRider } from '@/hooks/useRider';
import { Feather, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import type { Id } from '@tutem/api';
import { useMutation } from 'convex/react';
import { useAuthenticatedMutation } from '@/hooks/customApi';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Text,
  HorizontalRule,
  Loader,
  cn,
  Switch,
} from '@tutem/ui';
import * as ImagePicker from 'expo-image-picker';
import useThemeColors from '@/hooks/useColorScheme';
import { useFileUpload } from '@/hooks/useFileUpload';

const EXPANDED_HEADER_HEIGHT = 220;
const COLLAPSED_HEADER_HEIGHT = 60;
const SCROLL_DISTANCE = EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT;

export default function Profile() {
  const [image, setImage] = useState('');
  const [genderMatching, setGenderMatching] = useState<boolean>(false);
  const { signOut } = useAuth();
  const router = useRouter();
  const { iconColor, iconBackgroundColor } = useThemeColors();

  const { rider, isLoading: riderIsLoading } = useRider();

  const toggleGenderMatching = useAuthenticatedMutation(api.routes.rider.toggleGenderMatching);

  const handleLogout = async (riderId: Id<'rider'> | undefined) => {
    await signOut();
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

  if (rider === undefined || riderIsLoading) return <Loader subtitle="Loading profile…" />;
  if (rider === null) return <ErrorScreen message="User not found" />;

  const toggleGenderMatch = async () => {
    if (rider.riderDetails === null) return;
    setGenderMatching(true);
    try {
      await toggleGenderMatching({ id: rider.riderDetails._id });
    } catch (error) {
      console.log(`error ${error}`);
    } finally {
      setGenderMatching(false);
    }
  };

  return (
    <View className="flex-1 bg-secondary">
      {/* Hero Header */}
      <Animated.View
        style={[headerAnimatedStyle, { position: 'absolute', width: '100%' }]}
        className="overflow-hidden bg-primary">
        {/* Action Buttons — absolute, won't affect layout */}
        <Animated.View
          style={[actionButtonStyle, { position: 'absolute', top: 0, zIndex: 1 }]}
          className="mt-2 w-full flex-row items-center justify-between px-4">
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
                    firstName: rider.firstName,
                    lastName: rider?.lastName,
                    dob: rider.dob,
                    phoneNumber: rider.phoneNumber,
                    gender: rider.gender,
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
          </View>
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
                userId={rider._id}
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
                  {new Date(rider.dob).toLocaleDateString()}
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
                  {rider.gender}
                </Text>
              </View>
            </View>

            <HorizontalRule className="mx-6" />
            {/* Gender */}

            <View className="flex-row items-center gap-4 px-6 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-50">
                <MaterialIcons
                  name={rider.riderDetails?.genderMatching ? 'people' : 'public'}
                  size={20}
                  color={rider.riderDetails?.genderMatching ? '#16a34a' : '#ec4899'}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row justify-between">
                  <Text className="mb-0.5 text-xs font-medium text-slate-400">
                    Gender Preference
                  </Text>
                  <Switch
                    disabled={genderMatching}
                    checked={rider.riderDetails?.genderMatching}
                    onCheckedChange={toggleGenderMatch}
                    id="airplane-mode"
                    nativeID="airplane-mode"
                  />
                </View>
                <Text className="text-sm font-semibold tracking-wide text-slate-800">
                  {rider.riderDetails?.genderMatching
                    ? 'Ride with Same Gender'
                    : 'No Preference (Any)'}
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
                  {rider.phoneNumber}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function ImagePickerDialog({
  userId,
  profilePictureKey,
  setImageUri,
  scrollY,
  scrollDistance,
}: {
  userId: string;
  profilePictureKey: string | undefined;
  setImageUri: (uri: string) => void;
  scrollY: SharedValue<number>;
  scrollDistance: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { sessionToken } = useAuth();
  const uploadProfilePicture = useAuthenticatedMutation(api.routes.rider.uploadProfilePicture);
  const removeProfilePictureKey = useAuthenticatedMutation(
    api.routes.rider.removeProfilePictureKey
  );
  const { uploadFile } = useFileUpload();

  const handleUpload = async (newImgUri: string) => {
    setIsOpen(false);
    if (!sessionToken) return;
    if (newImgUri === '') return;
    setImageUri(newImgUri);
    const profilePictureKey = await uploadFile(newImgUri, `profilePicture/${userId}`);
    await uploadProfilePicture({ profilePictureKey });
  };

  const handleDelete = async () => {
    setIsOpen(false);
    if (!sessionToken) return;
    if (profilePictureKey === undefined) return;
    await removeProfilePictureKey();
    setImageUri('');
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
