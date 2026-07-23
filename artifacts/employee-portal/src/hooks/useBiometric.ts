import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!isNative) return;
    checkAvailability();
  }, [isNative]);

  async function checkAvailability() {
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
  }

  async function authenticate(reason: string): Promise<boolean> {
    if (!isNative) return false;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.verifyIdentity({
        reason,
        title: "Sunrise Portal",
        subtitle: "Biometric Login",
        description: reason,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function saveCredentials(username: string, password: string) {
    if (!isNative) return;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.setCredentials({
        username,
        password,
        server: "sunrise-portal",
      });
    } catch {
      /* ignore */
    }
  }

  async function getCredentials(): Promise<BiometricCredentials | null> {
    if (!isNative) return null;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      const creds = await NativeBiometric.getCredentials({
        server: "sunrise-portal",
      });
      return { username: creds.username, password: creds.password };
    } catch {
      return null;
    }
  }

  async function deleteCredentials() {
    if (!isNative) return;
    try {
      const { NativeBiometric } =
        await import("@capgo/capacitor-native-biometric");
      await NativeBiometric.deleteCredentials({ server: "sunrise-portal" });
    } catch {
      /* ignore */
    }
  }

  return {
    isAvailable: biometricInfo.isAvailable,
    biometryType: biometricInfo.biometryType,
    isNative,
    authenticate,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    checkAvailability,
  };
}
