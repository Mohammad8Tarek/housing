import { useState, useEffect, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";

interface BiometricResult {
  isAvailable: boolean;
  biometryType: string | null;
  error?: string;
}

interface BiometricCredentials {
  username: string;
  password: string;
}

export function useBiometric() {
  const [biometricInfo, setBiometricInfo] = useState<BiometricResult>({
    isAvailable: false,
    biometryType: null,
  });
  const isNative = Capacitor.isNativePlatform();

  const checkAvailability = useCallback(async () => {
    if (!isNative) return;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      const result = await NativeBiometric.isAvailable();
      setBiometricInfo({
        isAvailable: result.isAvailable,
        biometryType: result.isAvailable ? String(result.biometryType) : null,
      });
    } catch (err: unknown) {
      setBiometricInfo({
        isAvailable: false,
        biometryType: null,
        error: String(err),
      });
    }
  }, [isNative]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const authenticate = useCallback(async (reason: string): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.verifyIdentity({
        reason,
        title: "SUNRISE Resident Portal",
        subtitle: "Biometric Login",
        description: reason,
        negativeButtonText: "إلغاء / Cancel",
        maxAttempts: 5,
      });
      return true;
    } catch {
      return false;
    }
  }, [isNative]);

  const saveCredentials = useCallback(async (username: string, password: string) => {
    if (!isNative) return;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.setCredentials({
        username,
        password,
        server: "com.sunrisehousing.portal",
      });
    } catch {
      /* ignore */
    }
  }, [isNative]);

  const getCredentials = useCallback(async (): Promise<BiometricCredentials | null> => {
    if (!isNative) return null;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      const creds = await NativeBiometric.getCredentials({
        server: "com.sunrisehousing.portal",
      });
      return { username: creds.username, password: creds.password };
    } catch {
      return null;
    }
  }, [isNative]);

  const deleteCredentials = useCallback(async () => {
    if (!isNative) return;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.deleteCredentials({ server: "com.sunrisehousing.portal" });
    } catch {
      /* ignore */
    }
  }, [isNative]);

  return useMemo(() => ({
    isAvailable: biometricInfo.isAvailable,
    biometryType: biometricInfo.biometryType,
    isNative,
    authenticate,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    checkAvailability,
  }), [
    biometricInfo.isAvailable,
    biometricInfo.biometryType,
    isNative,
    authenticate,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    checkAvailability,
  ]);
}
