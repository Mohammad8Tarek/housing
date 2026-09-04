import { useState, useEffect } from "react";
import { useDebounce } from "./use-debounce";

export interface DuplicateInfo {
  exists: boolean;
  name: string;
  profileId: string;
  nationalId?: string;
  phone?: string;
}

export interface DuplicateResults {
  profileId?: DuplicateInfo;
  nationalId?: DuplicateInfo;
  phone?: DuplicateInfo;
}

interface UseCheckDuplicatesOptions {
  profileId?: string;
  nationalId?: string;
  phone?: string;
  excludeId?: number | null;
  enabled?: boolean;
}

export function useCheckDuplicates({
  profileId = "",
  nationalId = "",
  phone = "",
  excludeId,
  enabled = true,
}: UseCheckDuplicatesOptions) {
  const [duplicates, setDuplicates] = useState<DuplicateResults>({});
  const [isChecking, setIsChecking] = useState(false);

  const debouncedProfileId = useDebounce(profileId.trim(), 300);
  const debouncedNationalId = useDebounce(nationalId.trim(), 300);
  const debouncedPhone = useDebounce(phone.trim(), 300);

  useEffect(() => {
    if (!enabled) {
      setDuplicates({});
      return;
    }

    // If all fields are empty, clear duplicates
    if (!debouncedProfileId && !debouncedNationalId && !debouncedPhone) {
      setDuplicates({});
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function check() {
      setIsChecking(true);
      try {
        const params = new URLSearchParams();
        if (debouncedProfileId) params.append("profileId", debouncedProfileId);
        if (debouncedNationalId) params.append("nationalId", debouncedNationalId);
        if (debouncedPhone) params.append("phone", debouncedPhone);
        if (excludeId) params.append("excludeId", String(excludeId));

        const res = await fetch(`/api/profiles/check-duplicate?${params.toString()}`, {
          signal: controller.signal,
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          setDuplicates(data.duplicates || {});
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Duplicate check failed:", err);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    check();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [debouncedProfileId, debouncedNationalId, debouncedPhone, excludeId, enabled]);

  // Clean matched results so if user cleared a field it doesn't stay flagged
  const activeDuplicates: DuplicateResults = {};
  if (profileId.trim() && duplicates.profileId?.exists) {
    activeDuplicates.profileId = duplicates.profileId;
  }
  if (nationalId.trim() && duplicates.nationalId?.exists) {
    activeDuplicates.nationalId = duplicates.nationalId;
  }
  if (phone.trim() && duplicates.phone?.exists) {
    activeDuplicates.phone = duplicates.phone;
  }

  const hasDuplicates = Boolean(
    activeDuplicates.profileId || activeDuplicates.nationalId || activeDuplicates.phone
  );

  return {
    duplicates: activeDuplicates,
    isChecking,
    hasDuplicates,
  };
}
