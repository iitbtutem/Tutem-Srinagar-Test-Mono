import { Alert, Linking } from 'react-native';

export async function callPhone(phone: string) {
  if (!phone || !phone.trim()) {
    Alert.alert('Error', 'Phone number is not available');
    return;
  }
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const formattedPhone = cleanPhone.startsWith('+')
    ? cleanPhone
    : cleanPhone.length === 10
      ? `+91${cleanPhone}`
      : cleanPhone;
  const phoneAppLink = `tel:${formattedPhone}`;

  try {
    await Linking.openURL(phoneAppLink);
  } catch {
    Alert.alert('Error', 'Phone call not supported on this device');
  }
}

export async function openWhatsApp(phone: string) {
  if (!phone || !phone.trim()) {
    Alert.alert('Error', 'Phone number is not available');
    return;
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const whatsAppLink = `https://wa.me/${formattedPhone}`;

  try {
    await Linking.openURL(whatsAppLink);
  } catch {
    Alert.alert('Error', 'Unable to open WhatsApp');
  }
}
