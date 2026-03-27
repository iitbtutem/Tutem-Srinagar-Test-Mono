import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ScrollView, View, TextInput, TouchableOpacity } from 'react-native';
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
import { useMutation } from 'convex/react';
import { useToast } from '@/components/CustomToast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Id } from '@tutem/api';
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

export default function EditVehicle() {
    const router = useRouter();
    const { showToast } = useToast();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const {
        vehicleId,
        registrationNumber,
        type,
        model,
        fuelType,
        color,
        seatingCapacity,
        vehicleClass,
    } = useLocalSearchParams<{
        vehicleId: string;
        registrationNumber: string;
        type: typeof VEHICLE_TYPE[number];
        model: string;
        fuelType: typeof FUEL_TYPE[number];
        color: string;
        seatingCapacity: string;
        vehicleClass: typeof VEHICLE_CLASS[number];
    }>();

    const updateVehicle = useMutation(api.routes.vehicle.updateVehicle);

    const modelRef = useRef<TextInput>(null);
    const colorRef = useRef<TextInput>(null);
    const seatingRef = useRef<TextInput>(null);

    const {
        handleSubmit,
        control,
        formState: { errors },
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
        },
    });

    const onSubmit = handleSubmit(async (data: z.infer<typeof vehicleSchema>) => {
        try {
            if (!vehicleId) {
                showToast({ title: 'Error', description: 'Vehicle not found', type: 'error' });
                return;
            }
            await updateVehicle({
                id: vehicleId as Id<'vehicle'>,
                ...data,
            });
            showToast({ title: 'Success', description: 'Vehicle updated successfully', type: 'success' });
            router.back();
        } catch (error) {
            console.error(error);
            showToast({ title: 'Error', description: 'Failed to update vehicle', type: 'error' });
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

                <Text className="my-4 mb-2 text-lg font-semibold text-foreground px-3">Edit your vehicle details</Text>

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
                        <Text className="text-md text-destructive">{errors.registrationNumber.message as string}</Text>
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
                    {errors.model && <Text className="text-md text-destructive">{errors.model.message as string}</Text>}
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
                    {errors.color && <Text className="text-md text-destructive">{errors.color.message as string}</Text>}
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
                        <Text className="text-md text-destructive">{errors.seatingCapacity.message as string}</Text>
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
                                defaultValue={field.value ? { label: field.value, value: field.value } : undefined}
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
                    {errors.type && <Text className="text-md text-destructive">{errors.type.message as string}</Text>}
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
                                defaultValue={field.value ? { label: field.value, value: field.value } : undefined}
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
                    {errors.fuelType && <Text className="text-md text-destructive">{errors.fuelType.message as string}</Text>}
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
                                defaultValue={field.value ? { label: field.value, value: field.value } : undefined}
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
                    {errors.class && <Text className="text-md text-destructive">{errors.class.message as string}</Text>}
                </View>

                <Button onPress={onSubmit}>
                    <Text>Save Changes</Text>
                </Button>
            </View>
            </Animated.View>
            </KeyboardAwareScrollView>
            <KeyboardToolbar />
        </View>
    );
}
