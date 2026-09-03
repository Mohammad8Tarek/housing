// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type LookupValue = {
  id: number;
  propertyId: number;
  category: string;
  value: string;
  parentValue: string | null;
  extraValue: string | null;
  sortOrder: number;
  disabled: boolean;
};

const LOOKUP_CATEGORIES = {
  DEPARTMENT: "department",
  JOB_TITLE: "job_title",
  ROOM_TYPE: "room_type",
  NATIONALITY: "nationality",
} as const;

export { LOOKUP_CATEGORIES };

async function fetchLookupValues(
  propertyId: number,
  category?: string,
): Promise<LookupValue[]> {
  const params = new URLSearchParams({ propertyId: String(propertyId) });
  if (category) params.append("category", category);
  const res = await fetch(`/api/lookup-values?${params}`);
  if (!res.ok) throw new Error("Failed to fetch lookup values");
  return res.json();
}

async function createLookupValue(data: {
  propertyId: number;
  category: string;
  value: string;
  parentValue?: string;
  extraValue?: string;
}): Promise<LookupValue> {
  const res = await fetch("/api/lookup-values", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create lookup value");
  }
  return res.json();
}

async function deleteLookupValue(id: number): Promise<void> {
  const res = await fetch(`/api/lookup-values/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete lookup value");
}

export function getLookupValuesQueryKey(
  propertyId: number,
  category?: string,
  includeDisabled?: boolean,
) {
  return ["lookup-values", propertyId, category, includeDisabled];
}

export function useLookupValues(
  propertyId: number | undefined,
  category?: string,
  includeDisabled = false,
) {
  return useQuery({
    queryKey: getLookupValuesQueryKey(propertyId!, category, includeDisabled),
    queryFn: async () => {
      const data = await fetchLookupValues(propertyId!, category);
      return includeDisabled ? data : data.filter((v) => !v.disabled);
    },
    enabled: !!propertyId,
  });
}

export function useCreateLookupValue(propertyId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      category: string;
      value: string;
      parentValue?: string;
      extraValue?: string;
    }) => createLookupValue({ ...data, propertyId: propertyId! }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ["lookup-values", propertyId!],
      });
    },
  });
}

export function useDeleteLookupValue(
  propertyId: number | undefined,
  category?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteLookupValue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["lookup-values", propertyId!],
      });
    },
  });
}
