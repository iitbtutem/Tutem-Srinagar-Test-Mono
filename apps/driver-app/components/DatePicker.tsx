import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Feather } from "@expo/vector-icons"
import { cn } from '@/lib/utils';

export default function CustomDatePicker({
  title = "Choose Date",
  date,
  setDate,
}: {
  title?: string;
  date: Date | null;
  setDate: (date: Date) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button 
      onPress={() => setShow(true)} 
      variant={'outline'}
      className='justify-start'
      >
        <Feather name="calendar" size={18} color="gray" />
        <Text className={cn("pl-1 text-sm font-medium text-muted-foreground/50", {"text-primary": !!date})}>
          {date?.toLocaleDateString() ?? title}
        </Text>
      </Button>
      {show && (
        <DateTimePicker
          onBlur={() => console.log('leave')}
          onChange={(e) => {
            setShow(false);
            if(e.type === "dismissed") return;
            setDate(new Date(e.nativeEvent.timestamp));
          }}
          value={new Date()}
        />
      )}
    </>
  );
}
