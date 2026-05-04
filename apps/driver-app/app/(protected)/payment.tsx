import ErrorScreen from '@/components/ErrorScreen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, Id } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Pencil, QrCode, IndianRupee, CheckCircle2 } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { cn, distanceFormat, formatFare } from '@/lib/utils';
import { Separator } from '@/components/ui/seperator';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useRouter } from 'expo-router';

export default function Payment() {
  const { rideId, driverId, rideDistance, fare, duration } = useLocalSearchParams<{
    rideId: Id<'ride'>;
    driverId: Id<'driver'>;
    rideDistance: string;
    fare: string;
    duration: string;
  }>();
  const [uploading, setUploading] = useState(false);
  const { uploadFile } = useFileUpload();
  const router = useRouter();

  const driver = useQuery(
    api.routes.driver.getDriver,
    driverId ? { id: driverId } : 'skip'
  );

  const updatePaymentQrCode = useMutation(api.routes.driver.updatePaymentQrCode);


  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload a QR code.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setUploading(true);
        
        const paymentQrCodeKey = await uploadFile(result.assets[0].uri, `payementQrCodes/${driverId}`);
        await updatePaymentQrCode({
          driverId: driverId as Id<'driver'>,
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

  if (driver === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text className="mt-3 text-zinc-400 text-sm font-medium">Loading payment details…</Text>
      </View>
    );
  }

  if (driver === null) return <ErrorScreen message="Invalid User" code="404" />;

  const hasQrCode = driver.paymentQrCodeKey !== undefined;

  if(hasQrCode) console.log("QR Code URL:", driver.paymentQrCodeKey);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pb-12"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="my-4">
        <Text className="text-2xl font-bold text-primary tracking-tight">Payment</Text>
        <Text className="text-zinc-500 text-sm">Collect fare from your passenger</Text>
      </View>

      {/* Fare Card */}
      <Card className="border  rounded-2xl mb-5">
        <CardContent className="p-5">
          <View className="flex-row items-center gap-2 mb-1">
            <IndianRupee size={16} color="#78350f" strokeWidth={2.5} />
            <Text className="text-amber-900 text-xs font-semibold uppercase tracking-widest">
              Total Fare
            </Text>
          </View>
          <Text className="text-5xl font-black text-amber-950 tracking-tight">
            {formatFare(Number(fare))}
          </Text>
          <Separator className="my-3 bg-amber-400/60" />
          <View className="flex-row justify-between">
            <View>
              <Text className="text-amber-800 text-xs font-medium">Distance</Text>
              <Text className="text-amber-950 font-semibold text-sm">
                {distanceFormat(Number(rideDistance))}
              </Text>
            </View>
            <View>
              <Text className="text-amber-800 text-xs font-medium">Duration</Text>
              <Text className="text-amber-950 font-semibold text-sm">
                {duration}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-amber-800 text-xs font-medium">Status</Text>
              <View className="flex-row items-center gap-1">
                <CheckCircle2 size={12} color="#451a03" strokeWidth={2.5} />
                <Text className="text-amber-950 font-semibold text-sm">Completed</Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      <Card className="border border-primary rounded-2xl overflow-hidden">
        <CardHeader className="px-5 pt-5 pb-3">
          <View className="flex-row items-center gap-2">
            <QrCode size={18} color="#f59e0b" strokeWidth={2} />
            <CardTitle>
              <Text className="text-primary text-base font-semibold">
                Payment QR Code
              </Text>
            </CardTitle>
          </View>
          <Text className="text-zinc-500 text-xs mt-0.5">
            {hasQrCode
              ? 'Show this to your passenger for UPI payment'
              : 'Add your UPI QR code so passengers can pay digitally'}
          </Text>
        </CardHeader>

        <Separator className="bg-zinc-800 mx-4 w-fit" />

        <CardContent className="px-5 pb-5 pt-4">
          {/* QR Code Display - always mounted, hidden when no QR */}
          <View style={{ display: hasQrCode ? 'flex' : 'none' }} className="items-center">
            <View className="bg-white p-3 rounded-2xl mb-4 shadow-lg shadow-black/30">
              <Image
                source={{ uri: driver.paymentQrCodeKey ?? '' }}
                className="w-52 h-52 rounded-xl"
                resizeMode="contain"
              />
            </View>
            <Text className="text-zinc-400 text-xs mb-4 text-center">
              Scan with any UPI app · PhonePe · GPay · Paytm
            </Text>
            <Button
              onPress={handlePickImage}
              disabled={uploading}
              variant={"outline"}
              className="flex-row items-center justify-center gap-2 border rounded-xl w-full"
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <Pencil size={15} color="#a1a1aa" strokeWidth={2} />
              )}
              <Text className="text-zinc-300 font-medium text-sm">
                {uploading ? 'Uploading…' : 'Change QR Code'}
              </Text>
            </Button>
          </View>

          {/* Upload Prompt - always mounted, hidden when QR exists */}
          <View style={{ display: hasQrCode ? 'none' : 'flex' }} className="items-center py-4">
            <View className="w-24 h-24 rounded-2xl bg-muted border-2 border-dashed border-primary/25 items-center justify-center mb-4">
              <QrCode size={36} color="#52525b" strokeWidth={1.5} />
            </View>
            <Text className="text-zinc-300 font-semibold text-base mb-1">
              No QR Code Added
            </Text>
            <Text className="text-zinc-500 text-sm text-center mb-6 leading-5">
              Upload your UPI payment QR code to receive digital payments from passengers
            </Text>
            <Button
              onPress={handlePickImage}
              disabled={uploading}
              className="w-full bg-amber-500 active:bg-amber-400 rounded-xl h-12 flex-row items-center justify-center gap-2"
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#1c1917" />
              ) : (
                <Upload size={16} color="#1c1917" strokeWidth={2.5} />
              )}
              <Text className="text-amber-950 font-bold text-sm">
                {uploading ? 'Uploading…' : 'Upload from Gallery'}
              </Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <Text className="text-zinc-600 text-xs text-center mt-5 leading-5 mb-4">
        Cash payments are always accepted.{'\n'}QR code enables contactless UPI collection.
      </Text>

      <Button onPress={() => {
        router.push(`/feedback/${rideId}`)
      }}>
        <Text className=''>
          Give Feedback
        </Text>
      </Button>
    </ScrollView>
  );
}