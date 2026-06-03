import { Text, Input, Button } from '@tutem/ui';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import Animated from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { TextInput } from 'react-native-gesture-handler';
import { useColorScheme } from 'nativewind';
import { useToast } from '@/components/CustomToast';
import { useMutation } from 'convex/react';
import { api, Id } from '@tutem/api';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Stack } from 'expo-router';
import { BasicHeader } from '@/components/CustomHeader';
import Loader from '@/components/Loader';

const formSchema = z.object({
  licenseNumber: z
    .string('License number is required.')
    .min(14, 'License number must be at least 14 characters long.')
    .max(20, 'License number must be at most 20 characters long.'),
  licenseImageFrontKey: z.string().optional(),
  licenseImageBackKey: z.string().optional(),
});

export default function EditLicense() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldToUpdate, setCurrentFieldToUpdate] = useState<
    'licenseImageFrontKey' | 'licenseImageBackKey' | null
  >(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();
  
  const { uploadFile } = useFileUpload();

  const { licenseNumber, driverId, requiresLicenseImg } = useLocalSearchParams<{
    licenseNumber: string;
    driverId: string;
    requiresLicenseImg: string;
  }>();
  
  const updateLicense = useMutation(api.routes.driver.updateLicense);
  const requiresLicenseImage = requiresLicenseImg === 'true' ? true : false;

  const {
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting: formIsSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      licenseNumber: licenseNumber,
    },
  });

  const bottomSheetRef = useRef<BottomSheet>(null);
  const licenseRef = useRef<TextInput>(null);

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
      clearErrors(currentFieldToUpdate);
      setValue(currentFieldToUpdate, result.assets[0].uri);
    }
    setCurrentFieldToUpdate(null);
  };

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (!driverId) {
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

      const frontImageKey = await uploadFile(data.licenseImageFrontKey, `licenses/${driverId}-front`);
      const backImageKey = await uploadFile(data.licenseImageBackKey, `licenses/${driverId}-back`);

      await updateLicense({
        driverId: driverId as Id<'driver'>,
        backImageKey,
        frontImageKey,
        number: data.licenseNumber,
      });

      showToast({ title: 'Success', description: 'License updated successfully', type: 'success' });

      // Navigate to the main app after profile completion
      router.back();
    } catch (error: any) {
      showToast({
        title: 'Error',
        description: error.message || 'Failed to update license',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  });
  return (
    <View className="flex-1 bg-background">
      {isSubmitting && <Loader subtitle='submitting...' />}
      <Stack.Screen options={{ 
        headerShown: true,
        title: 'Edit License',
        header: (props) => <BasicHeader {...props} />,
      }} />
      <KeyboardAwareScrollView
        bottomOffset={62}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, padding: 8, paddingBottom: 100 }}>
        <Animated.View className="flex-1 gap-4 px-3 py-4">

          {/* License number */}
          <View>
            <View className="mb-1 flex-row items-center gap-1.5">
              <Feather name="credit-card" size={14} color="gray" />
              <Text className="text-sm font-medium text-muted-foreground">License Number</Text>
            </View>

            <Controller
              control={control}
              rules={{ required: true }}
              name="licenseNumber"
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
            />

            {errors.licenseNumber && (
              <Text className="mt-1 text-sm text-destructive">{errors.licenseNumber.message}</Text>
            )}
          </View>

          {/* Images */}
          {requiresLicenseImage && (
            <View className="gap-4">
              {(['licenseImageFrontKey', 'licenseImageBackKey'] as const).map((fieldKey) => (
                <View key={fieldKey}>
                  <Controller
                    control={control}
                    name={fieldKey}
                    render={({ field: { value, onChange } }) => (
                      <View>
                        {/* Label */}
                        <View className="mb-1 flex-row items-center gap-1.5">
                          <Feather name="image" size={14} color="gray" />
                          <Text className="text-sm font-medium text-muted-foreground">
                            {fieldKey === 'licenseImageFrontKey'
                              ? 'Front of License'
                              : 'Back of License'}
                          </Text>
                        </View>

                        {/* Image preview */}
                        {value ? (
                          <View className="relative h-40 w-full overflow-hidden rounded-lg border border-border">
                            <Image
                              source={{ uri: value }}
                              className="h-full w-full"
                              resizeMode="cover"
                            />

                            <TouchableOpacity
                              disabled={isSubmitting}
                              className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5"
                              onPress={() => onChange('')}>
                              <MaterialIcons name="delete-outline" size={20} color="red" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            disabled={isSubmitting}
                            className="h-12 w-full flex-row items-center justify-center gap-3 rounded-lg border border-border bg-muted"
                            onPress={() => {
                              setCurrentFieldToUpdate(fieldKey);
                              bottomSheetRef.current?.expand();
                              clearErrors(fieldKey);
                            }}>
                            <Feather name="upload" size={20} color="gray" />
                            <Text className="text-sm font-medium text-muted-foreground">
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
          <Button onPress={onSubmit} disabled={isSubmitting || formIsSubmitting} className='my-4'>
            <Text>Submit</Text>
          </Button>
        </Animated.View>
      </KeyboardAwareScrollView>

      {/* Image Picker Bottom Sheet (Placed at root to avoid touch interference) */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['35%']}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: isDark ? '#18181b' : '#FFFFFF' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#3f3f46' : '#E5E7EB' }}
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
