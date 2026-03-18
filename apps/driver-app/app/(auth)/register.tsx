import CustomDatePicker from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useState } from 'react';
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

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(['male', 'female', 'other'], 'Select gender'),
  dob: z.date('Enter your DOB'),
  licenseNumber: z.string().min(14, 'Invalid License number.'),
  organizationId: z.string().min(1, 'Select an organization.'),
});

const organizations = [
  {
    value: '1',
    label: 'SMC',
  },
  {
    value: '2',
    label: 'Heritic',
  },
];

export default function Signup() {
  // const [date, setDate] = useState<Date | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dob: undefined,
      licenseNumber: '',
      organizationId: '',
      gender: 'male',
    },
  });
  const onSubmit = (data: z.infer<typeof formSchema>) => console.log(data);
  // const date = getValues("dob")
  return (
    <View className="p-3">
      <Text className="my-4 text-lg font-semibold">Fill in your details</Text>
      <View className="gap-3 px-3 py-6">
        {/* First name  */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input placeholder="First name" onBlur={onBlur} onChangeText={onChange} value={value} />
          )}
          name="firstName"
        />
        {errors.firstName && (
          <Text className="text-md text-destructive">{errors.firstName.message}</Text>
        )}

        {/* Last name */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input placeholder="Last name" onBlur={onBlur} onChangeText={onChange} value={value} />
          )}
          name="lastName"
        />
        {errors.lastName && (
          <Text className="text-md text-destructive">{errors.lastName.message}</Text>
        )}

        <Controller
          name="dob"
          control={control}
          render={({ field, fieldState }) => (
            <>
              <CustomDatePicker
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

        {/* License number */}
        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="License Number"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="licenseNumber"
        />
        {errors.licenseNumber && (
          <Text className="text-md text-destructive">{errors.licenseNumber.message}</Text>
        )}

        {/* Organizations Select */}
        <Controller
          name="organizationId"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={(option) => field.onChange(option?.value)}
              value={organizations.find((el) => el.value === field.value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Organization" />
              </SelectTrigger>
              <SelectContent className="w-10/12">
                <SelectGroup>
                  <SelectLabel>Organization</SelectLabel>
                  {organizations.map((org) => (
                    <SelectItem key={org.value} label={org.label} value={org.value}>
                      {org.label}
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

        {/* Organizations Select */}
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
                  {['male', 'female', 'other'].map((gender) => (
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

        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Submit</Text>
        </Button>
      </View>
    </View>
  );
}
