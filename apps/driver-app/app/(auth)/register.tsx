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

export default function Signup() {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <View className="p-3">
      <Text className="my-4 text-lg font-semibold">Fill in your details</Text>
      <View className="gap-3 px-3 py-6">
        <Input placeholder="First Name" />
        <Input placeholder="Last Name" />
        <CustomDatePicker title="Choose DOB" date={date} setDate={setDate} />
        <Input placeholder="License Number" />

        <Select >
            <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Organization" />
          </SelectTrigger>
          <SelectContent className="w-10/12">
            <SelectGroup>
              <SelectLabel>Organization</SelectLabel>
              <SelectItem label="Apple" value="apple">
                Apple
              </SelectItem>
              <SelectItem label="Banana" value="banana">
                Banana
              </SelectItem>
              <SelectItem label="Blueberry" value="blueberry">
                Blueberry
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </View>
    </View>
  );
}
