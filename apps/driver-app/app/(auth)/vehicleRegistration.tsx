import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';
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

const vehicleSchema = z.object({
  registrationNumber: z.string().min(10, 'Registration number must be atleast 10 characters long.'),
  type: z.enum(VEHICLE_TYPE),
  model: z.string().min(2, 'Model name must be atleast 2 characters long.'),
  fuelType: z.enum(FUEL_TYPE),
  color: z.string().min(3, 'Color must be atleast 3 characters long.'),
  seatingCapacity: z.number().min(2, 'Seating capacity must be atleast 2.'),
  class: z.enum(VEHICLE_CLASS),
});

export default function VehicleRegistration() {
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

  const onSubmit = (data: z.infer<typeof vehicleSchema>) => console.log(data);

  return (
    <View className="p-3">
      <Text className="my-4 text-lg font-semibold">Fill in your vehicle details</Text>
      <View className="gap-3 px-3 py-6">
        {/* Registration Number */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="Registration Number"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="registrationNumber"
        />
        {errors.registrationNumber && (
          <Text className="text-md text-destructive">{errors.registrationNumber.message}</Text>
        )}

        {/* Type */}
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

        {/* Model */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="Vehicle Model"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="model"
        />
        {errors.model && <Text className="text-md text-destructive">{errors.model.message}</Text>}

        {/* Fuel Type */}
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
        {errors.fuelType && (
          <Text className="text-md text-destructive">{errors.fuelType.message}</Text>
        )}

        {/* Color */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input placeholder="Color" onBlur={onBlur} onChangeText={onChange} value={value} />
          )}
          name="color"
        />
        {errors.color && <Text className="text-md text-destructive">{errors.color.message}</Text>}

        {/* Seating Capacity */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              inputMode="numeric"
              keyboardType="number-pad"
              placeholder="Seating Capacity"
              onBlur={onBlur}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '');
                onChange(numeric === '' ? '' : Number(numeric));
              }}
              value={value?.toString() ?? ''}
            />
          )}
          name="seatingCapacity"
        />
        {errors.seatingCapacity && (
          <Text className="text-md text-destructive">{errors.seatingCapacity.message}</Text>
        )}

        {/* Class */}
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

        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Submit</Text>
        </Button>
      </View>
    </View>
  );
}
