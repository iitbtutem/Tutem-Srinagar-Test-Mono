import { View } from 'react-native';
import { Text } from '@tutem/ui';
import { differenceInYears } from 'date-fns';

const getAge = (birthDate: Date): string => {
  if (!(birthDate instanceof Date) || isNaN(birthDate.getTime())) {
    throw new Error("Invalid date provided");
  }

  const age = differenceInYears(new Date(), birthDate);

  return `${age} yrs`;
};

type Gender = 'Male' | 'Female' | 'Other';
function GenderAge({ gender, dob }: { gender: Gender, dob: string }) {
  const age = getAge(new Date(dob));
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-md bg-primary/5 px-3 py-1">      
      <Text className="text-xs font-medium text-primary">{`${gender} | ${age}`}</Text>
    </View>
  );
};

export { GenderAge };
