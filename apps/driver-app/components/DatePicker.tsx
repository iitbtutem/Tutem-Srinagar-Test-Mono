import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Feather } from '@expo/vector-icons';
import { cn } from '@/lib/utils';

type CustomDatePickerProps = {
  title?: string;
  date: Date | null;
  setDate: (date: Date) => void;
};

export type CustomDatePickerHandle = {
  open: () => void;
};

const CustomDatePicker = forwardRef<CustomDatePickerHandle, CustomDatePickerProps>(
  ({ title = 'Choose Date', date, setDate }, ref) => {
    const [show, setShow] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setShow(true),
    }));

    return (
      <>
        <Button
          onPress={() => setShow(true)}
          className="justify-start bg-muted-foreground/10 dark:bg-input/80">
          <Feather name="calendar" size={18} color="gray" />
          <Text
            className={cn('pl-1 text-sm font-medium text-muted-foreground/50', {
              'text-primary': !!date,
            })}>
            {date?.toLocaleDateString() ?? title}
          </Text>
        </Button>
        {show && (
          <DateTimePicker
            onBlur={() => console.log('leave')}
            onChange={(e) => {
              setShow(false);
              if (e.type === 'dismissed') return;
              setDate(new Date(e.nativeEvent.timestamp));
            }}
            value={new Date()}
          />
        )}
      </>
    );
  }
);

CustomDatePicker.displayName = 'CustomDatePicker';

export default CustomDatePicker;
