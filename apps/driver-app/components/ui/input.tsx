import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

const Input = forwardRef<TextInput, TextInputProps>(({ className, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      className={cn(
        'dark:bg-input/80 border-primary dark:border-foreground/60 bg-muted-foreground/10 text-foreground flex h-12 w-full min-w-0 flex-row items-center rounded-md focus:border-2 px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-11',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
