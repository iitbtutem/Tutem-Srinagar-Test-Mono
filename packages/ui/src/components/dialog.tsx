import * as DialogPrimitive from '@rn-primitives/dialog';
import * as React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { cn } from '../utils/cn';
import { TextClassContext } from './text';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogClose = DialogPrimitive.Close;

/**
 * Native Dialog Content - Uses RN Modal to create a new native window layer.
 * This ensures Select dropdowns render ABOVE the dialog via FullWindowOverlay.
 */
function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.ContentProps &
  React.RefAttributes<DialogPrimitive.ContentRef> & {
    className?: string;
  }) {
  const { open, onOpenChange } = DialogPrimitive.useRootContext();

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onOpenChange(false)}
    >
      {/* Overlay */}
      <View
        style={StyleSheet.absoluteFill}
        className="bg-black/60 z-50 items-center justify-center"
      >
        {/* Dismiss on tap outside */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onOpenChange(false)}
        />

        {/* Content container */}
        <View
          style={{ width: '92%', maxHeight: '85%' }}
          className={cn(
            'bg-background z-50 gap-4 rounded-3xl border border-border p-6 shadow-lg shadow-black/10',
            className
          )}
          {...(props as any)}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

function DialogHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) {
  return (
    <View
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) {
  return (
    <View
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.TitleProps & { className?: string }) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-foreground',
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DescriptionProps & { className?: string }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
