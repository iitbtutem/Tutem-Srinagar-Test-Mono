import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { View, TextInput, TouchableOpacity, Image, Platform } from 'react-native';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FUEL_TYPE, VEHICLE_CLASS, VEHICLE_TYPE } from '@/constants';
import React, { useMemo, useRef, useState } from 'react';
import { api } from '@tutem/api';
import { useMutation } from 'convex/react';
import { useToast } from '@/components/CustomToast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Id } from '@tutem/api';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/expo';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Stack } from 'expo-router';

type PickupImageKey = 'rcImageKey' | 'insuranceImageKey';

const vehicleSchema = z.object({
  registrationNumber: z.string().min(10, 'Registration number must be atleast 10 characters long.'),
  type: z.enum(VEHICLE_TYPE),
  model: z.string().min(2, 'Model name must be atleast 2 characters long.'),
  fuelType: z.enum(FUEL_TYPE),
  color: z.string().min(3, 'Color must be atleast 3 characters long.'),
  seatingCapacity: z.number().min(2, 'Seating capacity must be atleast 2.'),
  class: z.enum(VEHICLE_CLASS),
  rcImageKey: z.string().optional(),
  insuranceImageKey: z.string().optional(),
});

export default function EditVehicle() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colorScheme } = useColorScheme();
  const { uploadFile } = useFileUpload();

  const isDark = colorScheme === 'dark';

  const [imagePickupKey, setImagePickupKey] = useState<PickupImageKey>();


  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%'], []);

  const {
    vehicleId,
    registrationNumber,
    type,
    model,
    fuelType,
    color,
    seatingCapacity,
    vehicleClass,
    isRcRequired,
    isInsuranceImageRequired,
  } = useLocalSearchParams<{
    vehicleId: string;
    registrationNumber: string;
    type: (typeof VEHICLE_TYPE)[number];
    model: string;
    fuelType: (typeof FUEL_TYPE)[number];
    color: string;
    seatingCapacity: string;
    vehicleClass: (typeof VEHICLE_CLASS)[number];
    isRcRequired: string;
    isInsuranceImageRequired: string;
  }>();

  if (!vehicleId) {
    showToast({ title: 'Error', description: 'Vehicle not found', type: 'error' });
    return router.back();
  }

  const isVehicleRCVerificationRequired = isRcRequired === 'true' ? true : false;
  const isVehicleInsuranceImageRequired = isInsuranceImageRequired === 'true' ? true : false;

  const updateVehicle = useMutation(api.routes.vehicle.updateVehicle);

  const modelRef = useRef<TextInput>(null);
  const colorRef = useRef<TextInput>(null);
  const seatingRef = useRef<TextInput>(null);

  const {
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      registrationNumber: registrationNumber ?? '',
      type: type ?? undefined,
      model: model ?? '',
      fuelType: fuelType ?? undefined,
      color: color ?? '',
      seatingCapacity: seatingCapacity ? Number(seatingCapacity) : undefined,
      class: vehicleClass ?? undefined,
      rcImageKey: undefined,
      insuranceImageKey: undefined,
    },
  });

  const currentUser = useUser();

  const onSubmit = handleSubmit(async (data: z.infer<typeof vehicleSchema>) => {
    try {
      const rcImageKey = await uploadFile(
        data.rcImageKey,
        `vehicleRegisration/${currentUser.user?.id}}`
      );

      if (isVehicleRCVerificationRequired && rcImageKey === undefined) {
        return setError('rcImageKey', {
          type: 'required',
          message: 'RC image required',
        });
      };
      const insuranceImageKey = await uploadFile(data.insuranceImageKey, `vehicleInsurance/${currentUser.user?.id}}`);

      if (isVehicleRCVerificationRequired && insuranceImageKey === undefined) {
        setError('insuranceImageKey', {
          type: 'required',
          message: 'Insurance image required',
        });

        return showToast({
          type: 'error',
          title: 'Required',
          description: 'Insurance image is required',
        });
      }

      await updateVehicle({
        id: vehicleId as Id<'vehicle'>,
        ...data,
        rcImageKey,
        insuranceImageKey,
      });

      showToast({ title: 'Success', description: 'Vehicle updated successfully', type: 'success' });
      router.back();
    } catch (error) {

      showToast({ title: 'Error', description: 'Failed to update vehicle', type: 'error' });
    }
  });

  const handlePick = async (source: 'camera' | 'gallery', key: PickupImageKey) => {
    console.log("img key : ", key)
    bottomSheetRef.current?.close();
    // if (!currentFieldToUpdate) return;

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
      setValue(key, result.assets[0].uri);
    }
  };

  const isIos = Platform.OS === "ios";
  return (    
    <View className={cn("flex-1 bg-background", { "pt-6": isIos })}>
      <Stack.Screen options={{ headerShown: isIos ? false : true }} />
      <KeyboardAwareScrollView
        bottomOffset={50}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View entering={FadeIn.delay(300).duration(400)}>

          <View className="mb-2 flex-row items-center px-3">
            {isIos && <TouchableOpacity 
              className="mr-2 flex-row items-center" 
              onPress={() => {
                router.back();
            }}>
              <MaterialIcons
                name="keyboard-backspace"
                size={20}
                color={isDark ? 'white' : 'black'}
              />
            </TouchableOpacity>}

            <Text className="text-lg font-semibold">Edit your vehicle details</Text>
          </View>

          <View className="gap-3 px-3 pb-20 pt-2">
            {/* Registration Number */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="hash" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">
                  Registration Number
                </Text>
              </View>
              <Controller
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder="e.g. ABC-1234-XYZ"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="next"
                    onSubmitEditing={() => modelRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                )}
                name="registrationNumber"
              />
              {errors.registrationNumber && (
                <Text className="text-md text-destructive">
                  {errors.registrationNumber.message as string}
                </Text>
              )}
            </View>

            {/* Model */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="truck" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Vehicle Model</Text>
              </View>
              <Controller
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    ref={modelRef}
                    placeholder="e.g. Toyota Corolla"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="next"
                    onSubmitEditing={() => colorRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                )}
                name="model"
              />
              {errors.model && (
                <Text className="text-md text-destructive">{errors.model.message as string}</Text>
              )}
            </View>

            {/* Color */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="droplet" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Color</Text>
              </View>
              <Controller
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    ref={colorRef}
                    placeholder="e.g. White"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="next"
                    onSubmitEditing={() => seatingRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                )}
                name="color"
              />
              {errors.color && (
                <Text className="text-md text-destructive">{errors.color.message as string}</Text>
              )}
            </View>

            {/* Seating Capacity */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="users" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Seating Capacity</Text>
              </View>
              <Controller
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    ref={seatingRef}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    placeholder="e.g. 4"
                    onBlur={onBlur}
                    onChangeText={(text) => {
                      const numeric = text.replace(/[^0-9]/g, '');
                      onChange(numeric === '' ? '' : Number(numeric));
                    }}
                    value={value?.toString() ?? ''}
                    returnKeyType="done"
                  />
                )}
                name="seatingCapacity"
              />
              {errors.seatingCapacity && (
                <Text className="text-md text-destructive">
                  {errors.seatingCapacity.message as string}
                </Text>
              )}
            </View>

            {/* Vehicle Type */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="truck" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Vehicle Type</Text>
              </View>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    defaultValue={
                      field.value ? { label: field.value, value: field.value } : undefined
                    }
                    onValueChange={(option) => field.onChange(option?.value)}
                    value={{ label: field.value, value: field.value }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Vehicle Type" />
                    </SelectTrigger>
                    <SelectContent className="w-10/12">
                      <SelectGroup>
                        <SelectLabel>Vehicle Type</SelectLabel>
                        {VEHICLE_TYPE.map((t) => (
                          <SelectItem key={t} label={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <Text className="text-md text-destructive">{errors.type.message as string}</Text>
              )}
            </View>

            {/* Fuel Type */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="zap" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Fuel Type</Text>
              </View>
              <Controller
                name="fuelType"
                control={control}
                render={({ field }) => (
                  <Select
                    defaultValue={
                      field.value ? { label: field.value, value: field.value } : undefined
                    }
                    onValueChange={(option) => field.onChange(option?.value)}
                    value={{ label: field.value, value: field.value }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Fuel Type" />
                    </SelectTrigger>
                    <SelectContent className="w-10/12">
                      <SelectGroup>
                        <SelectLabel>Fuel Type</SelectLabel>
                        {FUEL_TYPE.map((t) => (
                          <SelectItem key={t} label={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fuelType && (
                <Text className="text-md text-destructive">
                  {errors.fuelType.message as string}
                </Text>
              )}
            </View>

            {/* Class */}
            <View>
              <View className="mb-1 flex-row items-center gap-1.5">
                <Feather name="star" size={14} color="gray" />
                <Text className="text-sm font-medium text-muted-foreground">Vehicle Class</Text>
              </View>
              <Controller
                name="class"
                control={control}
                render={({ field }) => (
                  <Select
                    defaultValue={
                      field.value ? { label: field.value, value: field.value } : undefined
                    }
                    onValueChange={(option) => field.onChange(option?.value)}
                    value={{ label: field.value, value: field.value }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Vehicle Class" />
                    </SelectTrigger>
                    <SelectContent className="w-10/12">
                      <SelectGroup>
                        <SelectLabel>Vehicle Class</SelectLabel>
                        {VEHICLE_CLASS.map((t) => (
                          <SelectItem key={t} label={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.class && (
                <Text className="text-md text-destructive">{errors.class.message as string}</Text>
              )}
            </View>

            {/* RC */}
            {isVehicleRCVerificationRequired && (
              <View className="mt-2 gap-4">
                <Controller
                  control={control}
                  name={'rcImageKey'}
                  render={({ field: { value, onChange } }) => (
                    <View className="items-start">
                      <View className="mb-1 flex-row items-center gap-1.5">
                        <Feather name="image" size={14} color="gray" />
                        <Text className="text-sm font-medium text-muted-foreground">
                          Vehicle Registration Image
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
                            setImagePickupKey("rcImageKey")
                            bottomSheetRef.current?.expand();
                            clearErrors('rcImageKey');
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
              </View>
            )}

            {errors.rcImageKey && (
              <Text className="text-md text-destructive">{errors.rcImageKey.message}</Text>
            )}
            
            {/* Insurance */}
            {isVehicleInsuranceImageRequired && (
              <View className="mt-2 gap-4">
                <Controller
                  control={control}
                  name={'insuranceImageKey'}
                  render={({ field: { value, onChange } }) => (
                    <View className="items-start">
                      <View className="mb-1 flex-row items-center gap-1.5">
                        <Feather name="image" size={14} color="gray" />
                        <Text className="text-sm font-medium text-muted-foreground">
                          Vehicle Insurance Image
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
                            setImagePickupKey("insuranceImageKey")
                            bottomSheetRef.current?.expand();
                            clearErrors('insuranceImageKey');
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
              </View>
            )}

            {errors.insuranceImageKey && (
              <Text className="text-md text-destructive">{errors.insuranceImageKey.message}</Text>
            )}

            <Button onPress={onSubmit} className='my-4'>
              <Text>Save Changes</Text>
            </Button>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: isDark ? '#18181b' : '#FFFFFF' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#3f3f46' : '#E5E7EB' }}
        backdropComponent={(props: any) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}>
        <BottomSheetView className="gap-6 p-6">
          <Text className="text-center text-xl font-bold">Select Image Source</Text>

          {imagePickupKey && <View className="flex-row justify-between">
            <TouchableOpacity
              className="mr-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900"
              onPress={() => handlePick('camera', imagePickupKey)}>
              <Feather name="camera" size={32} color={isDark ? '#a1a1aa' : 'gray'} />
              <Text className="font-semibold text-gray-600 dark:text-zinc-400">Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="ml-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900"
              onPress={() => handlePick('gallery', imagePickupKey)}>
              <Feather name="image" size={32} color={isDark ? '#a1a1aa' : 'gray'} />
              <Text className="font-semibold text-gray-600 dark:text-zinc-400">Gallery</Text>
            </TouchableOpacity>
          </View>}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
