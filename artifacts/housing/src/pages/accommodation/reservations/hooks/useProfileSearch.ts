import { useState, useEffect, useRef } from "react";
import { type ProfileResult } from "../../shared/profile-search";

interface UseProfileSearchArgs {
  activePropertyId: number | string | null | undefined;
  /** Called right after a profile is picked from the dropdown. */
  onProfileSelected: (emp: ProfileResult) => void;
}

/** Debounced existing-profile search (cross-property aware) used by the wizard. */
export function useProfileSearch({
  activePropertyId,
  onProfileSelected,
}: UseProfileSearchArgs) {
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(
    null,
  );
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<ProfileResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPropertyId, setSearchPropertyId] = useState<string>(
    activePropertyId && activePropertyId !== "all"
      ? String(activePropertyId)
      : "all",
  );
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Default search to "all" so cross-property employees are discovered immediately by name/code
    setSearchPropertyId("all");
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!empSearch.trim() || empSearch.trim().length < 1) {
      setEmpResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const effectivePropId =
          searchPropertyId && searchPropertyId !== "all"
            ? searchPropertyId
            : activePropertyId && activePropertyId !== "all"
              ? String(activePropertyId)
              : "";
        const pp = effectivePropId ? `&propertyId=${effectivePropId}` : "";
        const resp = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(empSearch.trim())}${pp}`,
          { credentials: "include" },
        );
        setEmpResults(await resp.json());
        setShowDropdown(true);
      } catch {
        setEmpResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [empSearch, searchPropertyId, activePropertyId]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectProfile = (emp: ProfileResult) => {
    setSelectedProfile(emp);
    setEmpSearch(`${emp.firstName} ${emp.lastName} (${emp.profileId})`);
    setShowDropdown(false);
    onProfileSelected(emp);
  };

  const clearProfile = () => {
    setSelectedProfile(null);
    setEmpSearch("");
    setEmpResults([]);
  };

  return {
    selectedProfile,
    setSelectedProfile,
    empSearch,
    setEmpSearch,
    empResults,
    isSearching,
    showDropdown,
    searchPropertyId,
    setSearchPropertyId,
    searchRef,
    selectProfile,
    clearProfile,
  };
}
