export async function getAddressFromCoords(cords: {
  latitude: number,
  longitude: number,
}): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google maps apikey not configured in Convex environment");
  }

  if (!apiKey) {
    console.error("No Google Maps API Key found");
    return "Unnamed Road";
  }

  if (apiKey) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${cords.latitude},${cords.longitude}&key=${apiKey}`,
      );
      const data = await response.json();
      if (data.status === "OK" && data.results.length > 0) {
        const title = data.results[0].formatted_address;
        // Format Google's usually long address to something shorter for UI
        return title.split(",").slice(0, 3).join(",");
      }
    } catch (googleError) {
      console.error("Google Geocoding fallback failed:", googleError);
    }
  }

  return "Unnamed Road";
}

export async function fetchRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  console.log("Fetch route called …");
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google maps apikey not configured in Convex environment");
  }

  if (!apiKey) {
    console.error("No Google Maps API Key found");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0].legs[0];

      return {
        distance: route.distance,
        duration: route.duration.text,
      };
    } else {
      console.error("Directions API error:", data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error("Failed to fetch route:", error);
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
};

// utils/geo.ts

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/**
 * Returns distance between two coordinates in meters
 * using the Haversine formula.
 */
export function getDistanceInMeters(
  point1: Coordinate,
  point2: Coordinate
): number {
  const EARTH_RADIUS_IN_METERS = 6371e3;

  const lat1 = degreesToRadians(point1.latitude);
  const lat2 = degreesToRadians(point2.latitude);

  const deltaLat = degreesToRadians(
    point2.latitude - point1.latitude
  );

  const deltaLng = degreesToRadians(
    point2.longitude - point1.longitude
  );

  const a =
    Math.sin(deltaLat / 2) *
      Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return EARTH_RADIUS_IN_METERS * c;
}

/**
 * Checks whether a point lies inside a bounding box.
 */
export function isPointInsideBoundingBox(
  point: Coordinate,
  boundingBox: BoundingBox
): boolean {
  return (
    point.latitude >= boundingBox.south &&
    point.latitude <= boundingBox.north &&
    point.longitude >= boundingBox.west &&
    point.longitude <= boundingBox.east
  );
}

/**
 * Generates a bounding box from polygon coordinates.
 */
export function getBoundingBoxFromPolygon(
  polygon: Coordinate[]
): BoundingBox {
  if (polygon.length === 0) {
    throw new Error(
      "Polygon must contain at least one coordinate."
    );
  }

  let north = polygon[0].latitude;
  let south = polygon[0].latitude;
  let east = polygon[0].longitude;
  let west = polygon[0].longitude;

  for (const point of polygon) {
    if (point.latitude > north) {
      north = point.latitude;
    }

    if (point.latitude < south) {
      south = point.latitude;
    }

    if (point.longitude > east) {
      east = point.longitude;
    }

    if (point.longitude < west) {
      west = point.longitude;
    }
  }

  return {
    north,
    south,
    east,
    west,
  };
}

/**
 * Checks whether a point lies inside a polygon
 * using the Ray Casting algorithm.
 */
export function isPointInsidePolygon(
  point: Coordinate,
  polygon: Coordinate[]
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  const x = point.longitude;
  const y = point.latitude;

  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;

    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects =
      yi > y !== yj > y &&
      x <
        ((xj - xi) * (y - yi)) /
          (yj - yi) +
          xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Checks whether a point lies inside a polygon
 * with an optimized bounding box pre-check.
 */
export function isPointInsidePolygonWithBoundingBox(
  point: Coordinate,
  polygon: Coordinate[],
  boundingBox?: BoundingBox
): boolean {
  const box =
    boundingBox ??
    getBoundingBoxFromPolygon(polygon);

  if (
    !isPointInsideBoundingBox(point, box)
  ) {
    return false;
  }

  return isPointInsidePolygon(
    point,
    polygon
  );
}

/**
 * Converts degrees to radians.
 */
function degreesToRadians(
  degrees: number
): number {
  return (degrees * Math.PI) / 180;
}
