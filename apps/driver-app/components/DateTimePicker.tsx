import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, Button, cn } from '@tutem/ui';
import { Feather } from '@expo/vector-icons';

type CustomDatePickerProps = {
  placeholder?: string;
  date: Date | null;
  setDate: (date: Date) => void;
  disabled?: boolean;
  minimumDate?: Date,
  maximumDate?: Date,
};

export type CustomDatePickerHandle = {
  open: () => void;
};

const CustomDatePicker = forwardRef<CustomDatePickerHandle, CustomDatePickerProps>(
  ({ placeholder = 'Choose Date', date, setDate, disabled = false, ...props }, ref) => {
    const [show, setShow] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setShow(true),
    }));

    return (
      <>
        <Button
          disabled={disabled}
          onPress={() => setShow(true)}
          className="justify-start h-12 bg-muted-foreground/10 dark:bg-input/80">
          <Feather name="calendar" size={18} color="gray" />
          <Text
            className={cn('pl-1 text-sm font-medium text-muted-foreground/50', {
              'text-primary': !!date,
            })}>
            {date?.toLocaleDateString() ?? placeholder}
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
            minimumDate={props.minimumDate}
            maximumDate={props.maximumDate}
          />
        )}
      </>
    );
  }
);

CustomDatePicker.displayName = 'CustomDatePicker';

export default CustomDatePicker;
