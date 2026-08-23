'use client';

import { useEffect, useState } from 'react';
import type { LiveCoords } from '../types/field-driver';

export function useLiveLocation() {
  const [liveLocation, setLiveLocation] = useState<LiveCoords | null>(null);
  const [liveAddress, setLiveAddress] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        let msg = err.message;
        if (err.code === 1) msg = "Location access denied. Please enable 'Location Services'.";
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!liveLocation) return;

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${liveLocation.lat}&lon=${liveLocation.lng}&zoom=18&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.display_name) setLiveAddress(data.display_name);
        }
      } catch (err) {
        console.error('Reverse geocoding failed', err);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [liveLocation?.lat, liveLocation?.lng]);

  const retryLocation = () => {
    setLocationError(null);
    window.location.reload();
  };

  return { liveLocation, liveAddress, locationError, retryLocation };
}
