export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('No Google Maps API Key found');
    return 'Unnamed Road';
  }

  if (apiKey) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const title = data.results[0].formatted_address;
        // Format Google's usually long address to something shorter for UI
        return title.split(',').slice(1, 3).join(',');
      }
    } catch (googleError) {
      console.error('Google Geocoding fallback failed:', googleError);
    }
  }

  return 'Unnamed Road';
}

export async function fetchRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('No Google Maps API Key found');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const points = data.routes[0].overview_polyline.points;
      const route = data.routes[0].legs[0];

      return {
        polyline: decodePolyline(points),
        distance: route.distance,
        duration: route.duration.text,
      };
    } else {
      console.error('Directions API error:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('Failed to fetch route:', error);
    return null;
  }
}

// Standard Google Polyline decoding algorithm
function decodePolyline(t: string) {
  let points = [];
  for (let step = 0, lat = 0, lng = 0; step < t.length; ) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = t.charCodeAt(step++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = t.charCodeAt(step++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}
