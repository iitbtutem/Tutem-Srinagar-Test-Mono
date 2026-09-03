import { EMERGENCY_NUMBER } from '@/constants';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

/**
 * Extracts a YouTube video ID from a bare ID or any YouTube URL.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
 * Returns null if the input is not a recognisable YouTube reference.
 */
export function getYoutubeId(input: string): string | null {
  if (!input) return null;
  // Already a bare ID (no slashes, no protocol)
  if (!input.includes('/') && !input.includes('?')) return input;
  try {
    const url = new URL(input);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1);
    if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/shorts/')[1];
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

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

export async function callEmergencyServices() {
  try {
    await Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
  } catch {
    Alert.alert('Error', 'Unable to make calls on this device.');
  }
}

/**
 * Opens WhatsApp with a pre-filled text message.
 * Uses whatsapp://send?text= so WhatsApp opens its contact chooser
 * with the message already drafted — rider just picks a contact and sends.
 * Falls back to web WhatsApp (wa.me) if the app is not installed.
 */
export async function openWhatsApp(message?: string) {
  const encoded = message ? encodeURIComponent(message) : '';
  // whatsapp://send?text= opens contact picker with pre-filled draft
  const whatsappApp = `whatsapp://send?text=${encoded}`;
  const whatsappWeb = `https://wa.me/?text=${encoded}`;

  try {
    // Note: canOpenURL for whatsapp:// requires <queries> in AndroidManifest.
    // We attempt openURL directly and catch failures instead of pre-checking.
    await Linking.openURL(whatsappApp);
  } catch {
    try {
      // Fallback: web WhatsApp
      await Linking.openURL(whatsappWeb);
    } catch {
      Alert.alert(
        'WhatsApp not found',
        'Please install WhatsApp to share your location with a contact.',
        [{ text: 'OK' }]
      );
    }
  }
}

/**
 * Shares the rider's current location on WhatsApp.
 *
 * Uses getLastKnownPositionAsync() first (returns cached GPS instantly, ~0ms delay).
 * Falls back to getCurrentPositionAsync() only if no cached position is available.
 * Opens WhatsApp's contact picker pre-filled with a Google Maps link.
 */
export async function shareLocationOnWhatsApp() {
  try {
    // Try cached location first — instant, no GPS wait
    let coords: Location.LocationObjectCoords | null = null;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        coords = lastKnown.coords;
      } else {
        // No cache — get a fresh fix with a short timeout
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = fresh.coords;
      }
    }

    const message = coords
      ? `Hey! I'm on a ride. Track my current location:\nhttps://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`
      : `Hey! I'm on a ride. Please check on me.`;

    await openWhatsApp(message);
  } catch {
    // If anything fails, still open WhatsApp with a plain message
    await openWhatsApp(`Hey! I'm on a ride. Please check on me.`);
  }
}

/**
 * Opens a video by YouTube ID or full URL.
 * - Bare YouTube IDs (e.g. "theytLvdnaE") → tries the YouTube app first, falls back to browser.
 * - Full URLs (http/https) → opened directly.
 */
export async function openVideo(videoId: string) {
  if (videoId.startsWith('http')) {
    await Linking.openURL(videoId);
    return;
  }
  const appUrl = `youtube://watch?v=${videoId}`;
  const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const supported = await Linking.canOpenURL(appUrl);
  await Linking.openURL(supported ? appUrl : webUrl);
}
