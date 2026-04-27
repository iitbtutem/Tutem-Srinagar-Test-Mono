import { useState, useEffect } from 'react';
import { getAddressFromCoords } from '@/lib/maps';

export function useAddressFromCoords(latitude?: number, longitude?: number) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;

    let isMounted = true;

    async function fetchAddress() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAddressFromCoords(latitude!, longitude!);
        if (isMounted) setAddress(result);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAddress();

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  return { address, loading, error };
}