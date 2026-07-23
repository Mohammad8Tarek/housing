/**
 * useGeolocation.ts — Browser geolocation access hook
 * Requests location permission and returns current position
 */
import { useState, useCallback } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    error: null,
    loading: false,
  });

  const isSupported = "geolocation" in navigator;

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            error: null,
            loading: false,
          });
          resolve(position);
        },
        (error) => {
          const msg =
            error.code === 1
              ? "Location permission denied"
              : error.code === 2
                ? "Location unavailable"
                : error.code === 3
                  ? "Location request timed out"
                  : "Unknown location error";
          setState((prev) => ({ ...prev, loading: false, error: msg }));
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }, [isSupported]);

  const watchPosition = useCallback(() => {
    if (!isSupported) return null;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          error: null,
          loading: false,
        });
      },
      (error) => {
        const msg =
          error.code === 1
            ? "Location permission denied"
            : error.code === 2
              ? "Location unavailable"
              : error.code === 3
                ? "Location request timed out"
                : "Unknown location error";
        setState((prev) => ({ ...prev, loading: false, error: msg }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSupported]);

  return {
    ...state,
    isSupported,
    getCurrentPosition,
    watchPosition,
  };
}
