import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ActivityIndicator, TextInput, View, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { cn } from '@/lib/utils';
import { useRef, useState, useMemo } from 'react';
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
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '@tutem/api';
import { Redirect, useRouter } from 'expo-router';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import { useAuth } from '@clerk/expo';
import ErrorScreen from '@/components/ErrorScreen';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
  licenseNumber: z.string('License number is required.').min(14, 'Invalid license number'),
  licenseImageFrontKey: z.string().optional(),
  licenseImageBackKey: z.string().optional(),
  organizationId: z.string().min(1, 'Select an organization.'),
  phoneNumber: z.string().min(1, "Phone number is required").max(10, "Invalid phone number")
});

export default function Register() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldToUpdate, setCurrentFieldToUpdate] = useState<'licenseImageFrontKey' | 'licenseImageBackKey' | null>(null);

  const router = useRouter();
  const { userId } = useAuth()
  const { showToast } = useToast();

  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const licenseRef = useRef<TextInput>(null);

  const organizations = useQuery(api.routes.organizations.getAllOrganizations);
  const addUser = useMutation(api.routes.user.addDriver);
  const getPresignedUrl = useAction(api.routes.upload.getPresignedUrl);
  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? "" })


  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dob: undefined,
      licenseImageFrontKey: undefined,
      licenseImageBackKey: undefined,
      organizationId: '',
      gender: 'Male',
      phoneNumber: "",
    },
  });

  const selectedOrgId = useWatch({ control, name: 'organizationId' });
  const selectedOrganization = organizations?.find((org) => org._id === selectedOrgId);
  const requiresLicenseImage = selectedOrganization?.isLicenseVerficationRequired ?? false;

  const snapPoints = useMemo(() => ['35%'], []);

  const handlePick = async (source: 'camera' | 'gallery') => {
    bottomSheetRef.current?.close();
    if (!currentFieldToUpdate) return;

    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return showToast({ type: "error", title: "Permission needed", description: "Camera permissions are required." });
      result = await ImagePicker.launchCameraAsync({ quality: 0.3 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return showToast({ type: "error", title: "Permission needed", description: "Camera roll permissions are required." });
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.3 });
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
        showToast({ title: 'Error', description: 'Please upload both front and back of your license', type: 'error' });
        return;
      }

      setIsSubmitting(true);

      const processUpload = async (fileUri: string | undefined, prefix: string) => {
        if (!fileUri || !fileUri.startsWith('file://')) return fileUri;

        showToast({ title: 'Info', description: `Uploading license ${prefix}...`, type: 'info' });
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const extension = fileUri.split('.').pop() || 'jpg';
        const fileKey = `licenses/${userId}-${prefix}-${Date.now()}.${extension}`;

        const { url: presignedUrl, key } = await getPresignedUrl({
          key: fileKey,
          contentType: blob.type
        });

        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': blob.type }
        });

        if (!uploadResponse.ok) throw new Error(`Failed to upload ${prefix} image to MinIO`);
        return key;
      };

      const uploadedFrontKey = await processUpload(data.licenseImageFrontKey, 'front');
      const uploadedBackKey = await processUpload(data.licenseImageBackKey, 'back');

      await addUser({
        ...data,
        dob: String(data.dob),
        clerkId: userId,
        licenseImageFrontKey: uploadedFrontKey,
        licenseImageBackKey: uploadedBackKey
      });

      showToast({ title: 'Success', description: 'Profile saved successfully', type: 'success' });

      // Navigate to the main app after profile completion
      router.replace('/(protected)/(tabs)');
    } catch (error: any) {
      showToast({ title: 'Error', description: error.message || 'Failed to save profile', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  });

  if (user === undefined) return <ActivityIndicator />

  if (user && userId) return <Redirect href="/" />

  if (organizations === undefined) return <ActivityIndicator />

  if (organizations.length === 0) {
    return <ErrorScreen message="No organizations found" />;
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="p-3 mb-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      >
        <Text className="my-4 text-lg font-semibold">Fill in your details</Text>
        <View className="gap-3 px-3 py-6">

          {/* Organizations Select */}
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
          {/* First name  */}
          <Controller
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="First name"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                blurOnSubmit={false}
              />
            )}
            name="firstName"
          />
          {errors.firstName && (
            <Text className="text-md text-destructive">{errors.firstName.message}</Text>
          )}

          {/* Last name */}
          <Controller
            name="lastName"
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                ref={lastNameRef}
                placeholder="Last name"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                blurOnSubmit={false}
              />
            )}
          />
          {errors.lastName && (
            <Text className="text-md text-destructive">{errors.lastName.message}</Text>
          )}


          {/* Phone number */}
          <Controller
            name="phoneNumber"
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <View className="relative">
                <Input
                  ref={phoneRef}
                  inputMode="tel"
                  placeholder="Mobile number"
                  maxLength={10}
                  onChangeText={onChange}
                  className=" pl-14 "
                  value={value}
                  returnKeyType="next"
                  onSubmitEditing={() => dobRef.current?.open()}
                />
                <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</Text>
              </View>
            )}
          />
          {errors.phoneNumber && (
            <Text className="text-md text-destructive">{errors.phoneNumber.message}</Text>
          )}

          <Controller
            name="dob"
            control={control}
            render={({ field, fieldState }) => (
              <>
                <CustomDatePicker
                  ref={dobRef}
                  title="Choose DOB"
                  date={field.value}
                  setDate={(date) => field.onChange(date)}
                />

                {fieldState.error && (
                  <Text className="text-md text-destructive">{fieldState.error.message}</Text>
                )}
              </>
            )}
          />

          {/* gender Select */}
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <Select
                onValueChange={(option) => field.onChange(option?.value)}
                value={{ label: field.value, value: field.value }}>
                <SelectTrigger className="w-full">
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

          {errors.gender && <Text className="text-md text-destructive">{errors.gender.message}</Text>}

          {/* License number */}
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
                onSubmitEditing={() => onSubmit()}
              />
            )}
            name="licenseNumber"
          />
          {errors.licenseNumber && (
            <Text className="text-md text-destructive">{errors.licenseNumber.message}</Text>
          )}

          {/* License Upload Buttons */}
          {requiresLicenseImage && (
            <View className="mb-2 mt-2 gap-4">
              {(['licenseImageFrontKey', 'licenseImageBackKey'] as const).map((fieldKey) => {
                const label = fieldKey === 'licenseImageFrontKey' ? 'Front of License' : 'Back of License';

                return (
                  <Controller
                    key={fieldKey}
                    control={control}
                    name={fieldKey}
                    render={({ field: { value, onChange } }) => (
                      <View className="items-start">
                        <Text className="mb-2 text-sm font-medium">{label}</Text>
                        {value ? (
                          <View className="bg-background w-full h-40 rounded-lg  shadow-black relative">
                            <Image source={{ uri: value }} className="w-full h-full rounded-lg" resizeMode="cover" />
                            <TouchableOpacity
                              disabled={isSubmitting}
                              className="bg-slate-100 rounded-tr-lg p-1 border border-slate-200 absolute top-0 right-0"
                              onPress={() => onChange(undefined)}
                            >
                              <MaterialIcons name="delete-outline" size={24} color="red" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            disabled={isSubmitting}
                            className={cn("bg-background w-full h-16 rounded-lg  flex-row items-center justify-center gap-4 border border-gray-300")}
                            onPress={() => {
                              setCurrentFieldToUpdate(fieldKey);
                              bottomSheetRef.current?.expand();
                            }}
                          >
                            <Feather name="upload" size={24} color="gray" />
                            <Text className="text-gray-500 font-bold tracking-wider">Select Image</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  />
                )
              })}
            </View>
          )}

          <Button onPress={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text>Submit</Text>}
          </Button>
        </View>

      </ScrollView>

      {/* Image Picker Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={(props: any) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetView className="p-6 gap-6">
          <Text className="text-xl font-bold text-center">Select Image Source</Text>

          <View className="flex-row justify-between">
            <TouchableOpacity
              className="bg-gray-100 flex-1 mr-2 h-32 rounded-xl items-center justify-center gap-2 border border-gray-200"
              onPress={() => handlePick('camera')}
            >
              <Feather name="camera" size={32} color="gray" />
              <Text className="font-semibold text-gray-600">Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-100 flex-1 ml-2 h-32 rounded-xl items-center justify-center gap-2 border border-gray-200"
              onPress={() => handlePick('gallery')}
            >
              <Feather name="image" size={32} color="gray" />
              <Text className="font-semibold text-gray-600">Gallery</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

    </KeyboardAvoidingView>
  );
}
