import { useToast } from '@/components/CustomToast';
import ErrorScreen from '@/components/ErrorScreen';
import LoadingScreen from '@/components/LoadingScreen';
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
import { useAuth } from '@/hooks/useAuth';
import { useDriver } from '@/hooks/useDriver';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, Id } from '@tutem/api';
import { useMutation, useQuery } from 'convex/react';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Image, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import Animated, { FadeInRight } from 'react-native-reanimated';
import z from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { cn } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import useThemeColors from '@/hooks/useColorScheme';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDriverLiveLocation } from '@/hooks/useDriverLiveLocation';
import { BasicHeader } from '@/components/CustomHeader';

const formSchema = z.object({
  licenseNumber: z
    .string('License number is required.')
    .min(14, 'License number must be at least 14 characters long.')
    .max(20, 'License number must be at most 20 characters long.'),
  licenseImageFrontKey: z.string().optional(),
  licenseImageBackKey: z.string().optional(),
  organizationId: z.string().min(1, 'Select an organization.'),
});

export default function RegisterAsRider() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldToUpdate, setCurrentFieldToUpdate] = useState<
    'licenseImageFrontKey' | 'licenseImageBackKey' | null
  >(null);

  const [initialLocationFetched, setInitialLocationFetched] = useState<{ latitude: number, longitude: number } | null>(null);

  const { userId } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();  
  const { expoPushToken } = useNotification();
    const driverLocation = useDriverLiveLocation();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor } = useThemeColors();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const licenseRef = useRef<TextInput>(null);

  const { driver } = useDriver();
  const registerAsDriver = useMutation(api.routes.driver.registerAsDriver);
  const organizations = useQuery(api.routes.organizations.getNearbyOrganization, initialLocationFetched ? { driverLocation: initialLocationFetched } : 'skip');
  const { uploadFile } = useFileUpload();

  const {
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  const selectedOrgId = useWatch({
    control,
    name: 'organizationId',
  });
  const selectedOrganization = organizations?.find((org) => org._id === selectedOrgId);
  const requiresLicenseImage = selectedOrganization?.isLicenseVerficationRequired ?? false;

  const snapPoints = useMemo(() => ['35%'], []);

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
      result = await ImagePicker.launchCameraAsync({ 
        allowsMultipleSelection: false,
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.3,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted')
        return showToast({
          type: 'error',
          title: 'Permission needed',
          description: 'Camera roll permissions are required.',
        });
      result = await ImagePicker.launchImageLibraryAsync({ 
        allowsMultipleSelection: false,
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.3,
      });
    }

    if (result && !result.canceled) {
      setValue(currentFieldToUpdate, result.assets[0].uri);
    }
    setCurrentFieldToUpdate(null);
  };

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (!userId) {
        showToast({ title: 'Error', description: 'User not found', type: 'error' });
        return;
      }

      if (requiresLicenseImage && (!data.licenseImageFrontKey || !data.licenseImageBackKey)) {
        if (!data.licenseImageFrontKey)
          setError('licenseImageFrontKey', { message: 'Front image is required' });
        if (!data.licenseImageBackKey)
          setError('licenseImageBackKey', { message: 'Back image is required' });
        
        return;
      }

      setIsSubmitting(true);

      showToast({ title: 'Info', description: `Uploading license images`, type: 'info' });

      const uploadedFrontKey = await uploadFile(data.licenseImageFrontKey, `licenses/${userId}-front`);
      const uploadedBackKey = await uploadFile(data.licenseImageBackKey, `licenses/${userId}-back`);

      const { licenseImageBackKey, licenseImageFrontKey, ...restData } = data;

      await registerAsDriver({
        ...restData,
        organizationId: data.organizationId as Id<'organization'>,
        userId: userId,
        licenseImageFrontKey: uploadedFrontKey,
        licenseImageBackKey: uploadedBackKey,
        expoPushToken: expoPushToken ?? undefined,
      });

      showToast({ title: 'Success', description: 'Account created successfully', type: 'success' });

      // Navigate to the main app after profile completion
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/createVehicle');
    } catch (error: any) {
      showToast({
        title: 'Error',
        description: error.message || 'Failed to create profile',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  useEffect(()=> {
    if(driverLocation && !initialLocationFetched) {
      setInitialLocationFetched(driverLocation);
    }
  }, [driverLocation]);

  if (driver && driver.driverDetails) return <Redirect href="/" />;

  if (organizations === undefined) return <LoadingScreen message="Fetching nearby organization…" />;

  if (organizations.length === 0) {
    return <ErrorScreen message="No organizations found near you" />;
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ 
        headerShown: true,
        title: "Driver Registration",
        header: (props) => <BasicHeader {...props} />, 
      }} />
      {isSubmitting && <Loader subtitle='submitting...' />}
      <KeyboardAwareScrollView
        bottomOffset={62}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, padding: 8 }}>
        <Animated.View
          entering={FadeInRight.delay(300).duration(400)}
          className="flex-1 bg-background">

          <Text className="px-3 text-lg font-semibold">Fill in your details</Text>

          <View className="mx-2 my-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Text className="text-sm text-blue-800">
              You are already registered with us. Fill in the required details below to
              register as a driver.
            </Text>
          </View>
          <View className="gap-3 px-3 pb-20 pt-2">
            {/* Organizations Select */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="briefcase" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Organization</Text>
              </View>
              <Controller
                name="organizationId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(option) => field.onChange(option?.value)}
                    value={{
                      label:
                        organizations.find((org) => org._id === field.value)?.name ??
                        'Select organization',
                      value: field.value,
                    }}>
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

              {errors.organizationId && (
                <Text className="text-md text-destructive">{errors.organizationId.message}</Text>
              )}
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
                    placeholder="License Number"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="done"
                  />
                )}
                name="licenseNumber"
              />
              {errors.licenseNumber && (
                <Text className="text-md text-destructive">{errors.licenseNumber.message}</Text>
              )}
            </View>

            {/* License Upload Buttons */}
            {requiresLicenseImage && (
              <View className="mb-2 mt-2 gap-4">
                {(['licenseImageFrontKey', 'licenseImageBackKey'] as const).map((fieldKey) => {
                  return (
                    <Controller
                      key={fieldKey}
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
                                onPress={() => onChange(undefined)}>
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
                                clearErrors(fieldKey);
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
                  );
                })}
              </View>
            )}

            <Button onPress={onSubmit} disabled={isSubmitting} className='my-3'>
              <Text>Submit</Text>
            </Button>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>

      {/* Image Picker Bottom Sheet (Placed at root to avoid touch interference) */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
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
              className="mr-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl bg-background border border-cyan-800"
              onPress={() => handlePick('camera')}>
              <Feather name="camera" size={32} color="#1ca0d9" />
              <Text className="font-semibold text-gray-600 dark:text-zinc-400">Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="ml-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl bg-background border border-orange-800"
              onPress={() => handlePick('gallery')}>
              <Feather name="image" size={32} color="#ed9d2d" />
              <Text className="font-semibold text-gray-600 dark:text-zinc-400">Gallery</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      <KeyboardToolbar />
    </View>
  );
}
