import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DateTimePicker';
import { Image, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Input,
  Text,
  Button,
  Loader,
} from '@tutem/ui';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { api } from '@tutem/api';
import type { Id } from '@tutem/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuthenticatedMutation } from '@/hooks/customApi';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import ErrorScreen from '@/components/ErrorScreen';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { cn } from '@/lib/utils';
import { useFileUpload } from '@/hooks/useFileUpload';
import useThemeColors from '@/hooks/useColorScheme';
import { BasicHeader } from '@/components/CustomHeader';
import { subYears } from 'date-fns';
import { useDriverLiveLocation } from '@/hooks/useDriverLiveLocation';
import { useDriver } from '@/hooks/useDriver';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
  licenseNumber: z
    .string('License number is required.')
    .min(14, 'License number must be at least 14 characters long.')
    .max(20, 'License number must be at most 20 characters long.'),
  organizationId: z.string().min(1, 'Select an organization.'),
  licenseImageFrontKey: z.string().optional(),
  licenseImageBackKey: z.string().optional(),
});

export default function EditProfile() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldToUpdate, setCurrentFieldToUpdate] = useState<
    'licenseImageFrontKey' | 'licenseImageBackKey' | null
  >(null);
  const router = useRouter();
  const { showToast } = useToast();
  const { uploadFile } = useFileUpload();
  const driverLocation = useDriverLiveLocation();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor } = useThemeColors();

  const [initialLocationFetched, setInitialLocationFetched] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const { firstName, lastName, dob, phoneNumber, licenseNumber, gender, organizationId } =
    useLocalSearchParams<{
      firstName: string;
      lastName?: string;
      dob: string;
      phoneNumber: string;
      licenseNumber?: string;
      gender: 'Male' | 'Female' | 'Other';
      organizationId: string;
    }>();

  const { driver, isLoading: isLoadingDriver } = useDriver();

  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);
  const licenseRef = useRef<TextInput>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const organizations = useQuery(
    api.routes.organizations.getNearbyOrganization,
    initialLocationFetched ? { driverLocation: initialLocationFetched } : 'skip'
  );
  const updateDriver = useAuthenticatedMutation(api.routes.driver.updateDriver);

  useEffect(() => {
    if (driverLocation && !initialLocationFetched) {
      setInitialLocationFetched(driverLocation);
    }
  }, [driverLocation]);

  const {
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: firstName,
      lastName: lastName,
      dob: new Date(dob),
      organizationId: organizationId,
      gender: gender,
      licenseNumber: licenseNumber,
    },
  });

  const selectedOrgId = useWatch({
    control,
    name: 'organizationId',
  });
  const selectedOrganization = organizations?.find((org) => org._id === selectedOrgId);
  const requiresLicenseImage = selectedOrganization?.isLicenseVerficationRequired ?? false;

  const handlePick = async (source: 'camera' | 'gallery') => {
    bottomSheetRef.current?.close();
    if (!currentFieldToUpdate) return;

    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted')
        return showToast({
          type: 'error',
          title: 'Permission needed',
          description: 'Camera permissions are required.',
        });
      result = await ImagePicker.launchCameraAsync({ quality: 0.3 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted')
        return showToast({
          type: 'error',
          title: 'Permission needed',
          description: 'Camera roll permissions are required.',
        });
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.3 });
    }

    if (result && !result.canceled) {
      clearErrors(currentFieldToUpdate);
      setValue(currentFieldToUpdate, result.assets[0].uri);
    }
    setCurrentFieldToUpdate(null);
  };

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (requiresLicenseImage && (!data.licenseImageFrontKey || !data.licenseImageBackKey)) {
        if (!data.licenseImageFrontKey)
          setError('licenseImageFrontKey', { message: 'Front image required' });
        if (!data.licenseImageBackKey)
          setError('licenseImageBackKey', { message: 'Back image required' });
        showToast({
          title: 'Error',
          description: 'Please upload both front and back of your license',
          type: 'error',
        });
        return;
      }

      if (!driver) {
        showToast({ title: 'Error', description: 'User not found', type: 'error' });
        return;
      }
      setIsSubmitting(true);

      const uploadedFrontKey = await uploadFile(
        data.licenseImageFrontKey,
        `licenses/${driver._id}-front`
      );
      const uploadedBackKey = await uploadFile(
        data.licenseImageBackKey,
        `licenses/${driver._id}-back`
      );
      const { dob, gender, ...rest } = data;
      await updateDriver({
        ...rest,
        organizationId: data.organizationId as Id<'organization'>,
        licenseImageFrontKey: uploadedFrontKey,
        licenseImageBackKey: uploadedBackKey,
      });

      showToast({ title: 'Success', description: 'Profile updated successfully', type: 'success' });

      router.replace('/profile');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to update profile', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  });

  if (organizations && organizations.length === 0) {
    return <ErrorScreen message="No organizations found near you" />;
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Profile',
          header: (props) => <BasicHeader {...props} />,
        }}
      />

      {isSubmitting && <Loader subtitle="submitting..." />}

      <KeyboardAwareScrollView
        bottomOffset={62}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, padding: 8 }}>
        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <View className="gap-3 px-3 pb-20 pt-2">
            {/* Organization */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="briefcase" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Organization</Text>
              </View>
              {organizations ? (
                <Controller
                  name="organizationId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      defaultValue={
                        field.value
                          ? {
                              value: field.value,
                              label:
                                organizations?.find((org) => org._id === field.value)?.name ||
                                field.value,
                            }
                          : undefined
                      }
                      value={
                        field.value
                          ? {
                              value: field.value,
                              label:
                                organizations?.find((org) => org._id === field.value)?.name ||
                                field.value,
                            }
                          : undefined
                      }
                      onValueChange={(option) => field.onChange(option?.value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Organization" />
                      </SelectTrigger>
                      <SelectContent className="w-10/12">
                        <SelectGroup>
                          <SelectLabel>Organization</SelectLabel>
                          {organizations.map((org) => (
                            <SelectItem key={org._id} label={org.name} value={org._id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : organizations === undefined ? (
                <Text className="text-md text-gray-600">Fetching organizations...</Text>
              ) : (
                <Text className="text-md text-destructive">No organizations found near you.</Text>
              )}

              {errors.organizationId && (
                <Text className="text-md text-destructive">{errors.organizationId.message}</Text>
              )}
            </View>
            {/* First name */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="user" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">First Name</Text>
              </View>
              <Controller
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder="Virat"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                )}
                name="firstName"
              />
              {errors.firstName && (
                <Text className="text-md text-destructive">{errors.firstName.message}</Text>
              )}
            </View>

            {/* Last name */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="user" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Last Name</Text>
              </View>
              <Controller
                name="lastName"
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    ref={lastNameRef}
                    placeholder="Kholi"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="next"
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                )}
              />
              {errors.lastName && (
                <Text className="text-md text-destructive">{errors.lastName.message}</Text>
              )}
            </View>

            {/* Phone number — pre-filled from auth, read-only */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="phone" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Mobile Number</Text>
              </View>
              <View className="relative">
                <Input
                  inputMode="tel"
                  value={phoneNumber}
                  editable={false}
                  className="pl-14 opacity-60"
                />
                <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500/60">
                  +91
                </Text>
              </View>
            </View>

            {/* DOB */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="calendar" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Date of Birth</Text>
              </View>
              <Controller
                name="dob"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <CustomDatePicker
                      disabled={true}
                      ref={dobRef}
                      placeholder="Choose DOB"
                      date={field.value}
                      setDate={(date) => {
                        field.onChange(date);
                        licenseRef.current?.focus();
                      }}
                      maximumDate={subYears(new Date(), 18)}
                    />
                    {fieldState.error && (
                      <Text className="text-md text-destructive">{fieldState.error.message}</Text>
                    )}
                  </>
                )}
              />
            </View>

            {/* License number */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="credit-card" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">License Number</Text>
              </View>
              <Controller
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    ref={licenseRef}
                    placeholder="DL-1234567890123"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="done"
                    onSubmitEditing={() => onSubmit()}
                  />
                )}
                name="licenseNumber"
              />
              {errors.licenseNumber && (
                <Text className="text-md text-destructive">{errors.licenseNumber.message}</Text>
              )}
            </View>

            {/* Gender */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="users" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Gender</Text>
              </View>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select
                    defaultValue={
                      field.value
                        ? {
                            value: field.value,
                            label: field.value,
                          }
                        : undefined
                    }
                    value={
                      field.value
                        ? {
                            value: field.value,
                            label: field.value,
                          }
                        : undefined
                    }
                    onValueChange={(option) => field.onChange(option?.value)}>
                    <SelectTrigger className="w-full" disabled={true}>
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent className="w-10/12">
                      <SelectGroup>
                        <SelectLabel>Gender</SelectLabel>
                        {GENDER.map((gender) => (
                          <SelectItem key={gender} label={gender} value={gender}>
                            {gender}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.gender && (
                <Text className="text-md text-destructive">{errors.gender.message}</Text>
              )}
            </View>

            {/* License Upload Buttons */}
            {requiresLicenseImage && (
              <View className="mb-2 mt-2 gap-4">
                {(['licenseImageFrontKey', 'licenseImageBackKey'] as const).map((fieldKey) => (
                  <View key={fieldKey}>
                    <Controller
                      control={control}
                      name={fieldKey}
                      render={({ field: { value, onChange } }) => (
                        <View className="items-start">
                          <View className="mb-1 flex-row items-center gap-1.5">
                            <Feather name="image" size={14} color="gray" />
                            <Text className="text-sm font-medium text-muted-foreground">
                              {fieldKey === 'licenseImageFrontKey'
                                ? 'Front of License'
                                : 'Back of License'}
                            </Text>
                          </View>
                          {value ? (
                            <View className="relative h-40 w-full rounded-lg bg-background shadow-black">
                              <Image
                                source={{ uri: value }}
                                className="h-full w-full rounded-lg"
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                disabled={isSubmitting}
                                className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow-md"
                                onPress={() => onChange({ fileUri: undefined, uploadedKey: '' })}>
                                <MaterialIcons name="delete-outline" size={20} color="red" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              disabled={isSubmitting}
                              className={cn(
                                'h-12 w-full flex-row items-center justify-center gap-4 rounded-lg border border-gray-300 bg-background'
                              )}
                              onPress={() => {
                                setCurrentFieldToUpdate(fieldKey);
                                bottomSheetRef.current?.expand();
                              }}>
                              <Feather name="upload" size={24} color="gray" />
                              <Text className="font-bold tracking-wider text-gray-500">
                                Select Image
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    />
                    {errors[fieldKey] && (
                      <Text className="text-md text-destructive">{errors[fieldKey].message}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Button onPress={onSubmit} className="my-4">
              <Text>Submit</Text>
            </Button>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
      {/* Image Picker Bottom Sheet (Placed at root to avoid touch interference) */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['35%']}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor }}
        backdropComponent={(props: any) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}>
        <BottomSheetView className="gap-6 p-6">
          <Text className="text-center text-xl font-bold">Select Image Source</Text>

          <View className="flex-row justify-between">
            <TouchableOpacity
              className="mr-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-800"
              onPress={() => handlePick('camera')}>
              <Feather name="camera" size={32} color="#1ca0d9" />
              <Text className="font-semibold text-gray-600">Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="ml-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl border border-orange-800"
              onPress={() => handlePick('gallery')}>
              <Feather name="image" size={32} color="#ed9d2d" />
              <Text className="font-semibold text-gray-600">Gallery</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
