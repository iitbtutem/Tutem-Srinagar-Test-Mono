import { cn } from '@/lib/utils';
import * as SeparatorPrimitive from '@rn-primitives/separator';
import { View } from 'react-native';
 
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  );
}

function HorizontalRule({className}: {className?: string}) {
    return <View className={cn("h-px bg-slate-100 dark:bg-zinc-800", className)} />
}
 
export { Separator, HorizontalRule };