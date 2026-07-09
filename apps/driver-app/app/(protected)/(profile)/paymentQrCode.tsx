import { Text, Button, Loader } from '@tutem/ui';
import { api, Id } from '@tutem/api';
import { useAuthenticatedQuery } from '@/hooks/customApi';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Pencil, QrCode } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { BasicHeader } from '@/components/CustomHeader';

export default function PaymentQrCard() {
  const { driverId } = useLocalSearchParams<{ driverId: Id<'driver'> }>();

  const [uploading, setUploading] = useState(false);
  const { uploadFile } = useFileUpload();

  const driverPaymentQrImage = useAuthenticatedQuery(
    api.routes.driver.getDriverPaymentQrImage,
    driverId ? { driverId } : 'skip'
  );

  const updatePaymentQrCode = useMutation(api.routes.driver.updatePaymentQrCode);

  const handlePickImage = useCallback(async () => {
    if (!driverId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload a QR code.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setUploading(true);

        const paymentQrCodeKey = await uploadFile(
          result.assets[0].uri,
          `payementQrCodes/${driverId}`
        );
        await updatePaymentQrCode({
          driverId: driverId,
          paymentQrCodeKey: paymentQrCodeKey,
        });
      } catch (e) {
        Alert.alert('Upload Failed', 'Could not upload QR code. Please try again.');
      } finally {
        setUploading(false);
      }
    }
    return;
  }, [driverId]);

  if (driverPaymentQrImage === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Loader subtitle="Loading payment details..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white/50 px-4 py-6">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Payment QR Code',
          header: (props) => <BasicHeader {...props} />,
        }}
      />
      <View className="overflow-hidden">
        <View className="flex-row items-center gap-2 pb-3">
          <View className="rounded-xl bg-orange-500/10 p-2">
            <QrCode size={24} color="#f59e0b" strokeWidth={2} />
          </View>

          <View>
            <Text className="text-base font-semibold">Payment QR Code</Text>
            <Text className="mt-0.5 text-xs text-zinc-500">
              {driverPaymentQrImage
                ? 'Show this to your passenger for UPI payment'
                : `Add your UPI QR code so passengers can \n pay digitally`}
            </Text>
          </View>
        </View>

        <View className="px-3 pb-5 pt-4">
          {/* QR Code Display - always mounted, hidden when no QR */}
          <View
            style={{ display: driverPaymentQrImage ? 'flex' : 'none' }}
            className="items-center">
            <View className="mb-4 rounded-2xl bg-white p-3 shadow-lg shadow-black/30">
              <Image
                source={{ uri: driverPaymentQrImage ?? '' }}
                className="aspect-square w-full rounded-xl"
                resizeMode="contain"
              />
            </View>
            <Button
              onPress={handlePickImage}
              disabled={uploading}
              variant={'default'}
              className="w-full rounded-2xl">
              <Pencil size={15} color="#ffffff" strokeWidth={2} />
              <Text className="text-sm font-medium">
                {uploading ? 'Uploading…' : 'Change QR Code'}
              </Text>
            </Button>
          </View>

          {/* Upload Prompt - always mounted, hidden when QR exists */}
          <View
            style={{ display: driverPaymentQrImage ? 'none' : 'flex' }}
            className="items-center py-4">
            <View className="mb-4 h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-primary/25 bg-muted">
              <QrCode size={36} color="#52525b" strokeWidth={1.5} />
            </View>
            <Text className="mb-1 text-base font-semibold text-zinc-300">No QR Code Added</Text>
            <Text className="mb-6 text-center text-sm leading-5 text-zinc-500">
              Upload your UPI payment QR code to receive digital payments from passengers
            </Text>
            <Button
              onPress={handlePickImage}
              disabled={uploading}
              className="h-12 w-full flex-row items-center justify-center gap-2 rounded-xl bg-amber-500 active:bg-amber-400">
              <Upload size={16} color="#1c1917" strokeWidth={2.5} />
              <Text className="text-sm font-bold text-amber-950">Upload from Gallery</Text>
            </Button>
          </View>
        </View>
      </View>
      {uploading && <Loader title="Uploading QR Code..." subtitle="Please wait a moment." />}
    </View>
  );
}
