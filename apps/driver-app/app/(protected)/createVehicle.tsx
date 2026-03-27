import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { View, TextInput, TouchableOpacity } from 'react-native';
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
import React, { useRef } from 'react';
import { api } from '@tutem/api';
import { useUser } from '@clerk/expo';
import { useMutation, useQuery } from 'convex/react';
import { useToast } from '@/components/CustomToast';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

const vehicleSchema = z.object({
  registrationNumber: z.string().min(10, 'Registration number must be atleast 10 characters long.'),
  type: z.enum(VEHICLE_TYPE),
  model: z.string().min(2, 'Model name must be atleast 2 characters long.'),
  fuelType: z.enum(FUEL_TYPE),
  color: z.string().min(3, 'Color must be atleast 3 characters long.'),
  seatingCapacity: z.number().min(2, 'Seating capacity must be atleast 2.'),
  class: z.enum(VEHICLE_CLASS),
});

export default function CreateVehicle() {
  const { user } = useUser();
  const router = useRouter();
  const { showToast } = useToast();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const currentUser = useQuery(api.routes.user.getUser, { clerkId: user?.id ?? '' });
  const addVehicle = useMutation(api.routes.vehicle.addVehicle);

  const modelRef = useRef<TextInput>(null);
  const colorRef = useRef<TextInput>(null);
  const seatingRef = useRef<TextInput>(null);

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      registrationNumber: '',
      type: undefined,
      model: '',
      fuelType: undefined,
      color: '',
      seatingCapacity: undefined,
      class: undefined,
    },
  });

  const onSubmit = handleSubmit(async (data: z.infer<typeof vehicleSchema>) => {
    try {
      if (currentUser) {
        await addVehicle({
          ...data,
          ownerId: currentUser._id,
        });
        showToast({ title: 'Vehicle registered successfully', type: 'success' });
        router.back();
      }
    } catch (error) {
      console.error(error);
      showToast({ title: 'Something went wrong', type: 'error' });
    }
  });

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        bottomOffset={62}
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 12 }}>
        <Animated.View entering={FadeIn.delay(300).duration(400)}>
        {/* Back button */}
        <TouchableOpacity
          className="flex-row items-center gap-1.5 self-start mb-2 mt-1"
          onPress={() => router.back()}>
          <MaterialIcons name="keyboard-backspace" size={20} color={isDark ? 'white' : 'black'} />
          <Text className="text-sm font-medium text-foreground opacity-90">Back</Text>
        </TouchableOpacity>

        <Text className="my-4 mb-2 text-lg font-semibold text-foreground px-3">Register your vehicle</Text>

        <View className="gap-3 px-3 pb-20 pt-2">
          {/* Registration Number */}
          <View>
            <View className="mb-1 flex-row items-center gap-1.5">
              <Feather name="hash" size={14} color="gray" />
              <Text className="text-sm font-medium text-muted-foreground">Registration Number</Text>
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
              <Text className="text-md text-destructive">{errors.registrationNumber.message}</Text>
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
            {errors.model && <Text className="text-md text-destructive">{errors.model.message}</Text>}
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
            {errors.color && <Text className="text-md text-destructive">{errors.color.message}</Text>}
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
              <Text className="text-md text-destructive">{errors.seatingCapacity.message}</Text>
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
                  onValueChange={(option) => field.onChange(option?.value)}
                  value={{ label: field.value, value: field.value }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent className="w-10/12">
                    <SelectGroup>
                      <SelectLabel>Vehicle Type</SelectLabel>
                      {VEHICLE_TYPE.map((type) => (
                        <SelectItem key={type} label={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.type && <Text className="text-md text-destructive">{errors.type.message}</Text>}
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
                  onValueChange={(option) => field.onChange(option?.value)}
                  value={{ label: field.value, value: field.value }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Fuel Type" />
                  </SelectTrigger>
                  <SelectContent className="w-10/12">
                    <SelectGroup>
                      <SelectLabel>Fuel Type</SelectLabel>
                      {FUEL_TYPE.map((type) => (
                        <SelectItem key={type} label={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.fuelType && <Text className="text-md text-destructive">{errors.fuelType.message}</Text>}
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
                  onValueChange={(option) => field.onChange(option?.value)}
                  value={{ label: field.value, value: field.value }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Vehicle Class" />
                  </SelectTrigger>
                  <SelectContent className="w-10/12">
                    <SelectGroup>
                      <SelectLabel>Vehicle Class</SelectLabel>
                      {VEHICLE_CLASS.map((type) => (
                        <SelectItem key={type} label={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.class && <Text className="text-md text-destructive">{errors.class.message}</Text>}
          </View>

          <Button onPress={onSubmit}>
            <Text>Register Vehicle</Text>
          </Button>
        </View>
      </Animated.View>
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
    </View>
  );
}
