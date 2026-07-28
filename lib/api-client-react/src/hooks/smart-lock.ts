import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

// ─── Encoder Types ───
export type EncoderType = "ip" | "usb" | "smart";

// ─── Encoder Status ───
export const getEncoderStatusUrl = (type: EncoderType = "ip") =>
  `/api/encoder/status?type=${type}`;
export const getEncoderStatus = async (
  type: EncoderType = "ip",
  options?: { signal?: AbortSignal },
) => {
  return customFetch<{
    connected: boolean;
    host: string;
    port: number;
    lastActivity?: string;
    type: EncoderType;
  }>(getEncoderStatusUrl(type), { signal: options?.signal });
};
export const getEncoderStatusQueryKey = (type: EncoderType = "ip") =>
  ["/api/encoder/status", type] as const;
export const getEncoderStatusQueryOptions = (
  type: EncoderType = "ip",
  options?: any,
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getEncoderStatusQueryKey(type);
  const queryFn = ({ signal }: any) => getEncoderStatus(type, { signal });
  return { queryKey, queryFn, refetchInterval: 3000, ...queryOptions };
};
export function useEncoderStatus(type: EncoderType = "ip", options?: any) {
  const queryOptions = getEncoderStatusQueryOptions(type, options);
  return useQuery<{
    connected: boolean;
    host: string;
    port: number;
    lastActivity?: string;
    type: EncoderType;
  }>(queryOptions);
}

// ─── Connect Encoder ───
export const connectEncoder = async (data: {
  type: EncoderType;
  host?: string;
  port?: number;
}) => {
  return customFetch<{ success: boolean; status: any; type: EncoderType }>(
    "/api/encoder/connect",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
};
export const useConnectEncoder = (options?: any) => {
  return useMutation<
    unknown,
    Error,
    { type: EncoderType; host?: string; port?: number }
  >({
    mutationKey: ["connectEncoder"],
    mutationFn: connectEncoder,
    ...options,
  });
};

// ─── Disconnect Encoder ───
export const disconnectEncoder = async (type: EncoderType = "ip") => {
  return customFetch<{ success: boolean }>("/api/encoder/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
};
export const useDisconnectEncoder = (options?: any) => {
  return useMutation<unknown, Error, EncoderType>({
    mutationKey: ["disconnectEncoder"],
    mutationFn: disconnectEncoder,
    ...options,
  });
};

// ─── Read Card ───
export const readCard = async (type: EncoderType = "ip") => {
  return customFetch<any>("/api/encoder/read-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
};
export const useReadCard = (options?: any) => {
  return useMutation<unknown, Error, EncoderType>({
    mutationKey: ["readCard"],
    mutationFn: readCard,
    ...options,
  });
};

// ─── Eject Card ───
export const ejectCard = async (type: EncoderType = "ip") => {
  return customFetch<any>("/api/encoder/eject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
};
export const useEjectCard = (options?: any) => {
  return useMutation<unknown, Error, EncoderType>({
    mutationKey: ["ejectCard"],
    mutationFn: ejectCard,
    ...options,
  });
};

// ─── Direct Encode (via encoder, no DB) ───
export const encodeCard = async (data: {
  type: EncoderType;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  cardType?: string;
  ejectionType?: string;
  user?: string;
}) => {
  return customFetch<any>("/api/encoder/encode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};
export const useEncodeCard = (options?: any) => {
  return useMutation<
    unknown,
    Error,
    {
      type: EncoderType;
      roomNumber: string;
      checkIn: string;
      checkOut: string;
      cardType?: string;
      ejectionType?: string;
      user?: string;
    }
  >({
    mutationKey: ["encodeCard"],
    mutationFn: encodeCard,
    ...options,
  });
};

// ─── List Serial Ports ───
export const getSerialPorts = async () => {
  return customFetch<
    { path: string; manufacturer?: string; serialNumber?: string }[]
  >("/api/encoder/serial-ports");
};
export const useSerialPorts = (options?: any) => {
  return useQuery({
    queryKey: ["/api/encoder/serial-ports"],
    queryFn: getSerialPorts,
    ...options,
  });
};

// ─── Keys List ───
export const getKeysUrl = (propertyId: number, roomId?: number) => {
  let url = `/api/keys?propertyId=${propertyId}`;
  if (roomId) url += `&roomId=${roomId}`;
  return url;
};
export const getKeys = async (propertyId: number, roomId?: number) => {
  return customFetch<any[]>(getKeysUrl(propertyId, roomId));
};
export const getKeysQueryKey = (propertyId: number, roomId?: number) =>
  ["/api/keys", propertyId, roomId] as const;
export const useKeys = (propertyId: number, roomId?: number, options?: any) => {
  return useQuery<any[]>({
    queryKey: getKeysQueryKey(propertyId, roomId),
    queryFn: () => getKeys(propertyId, roomId),
    enabled: !!propertyId,
    ...options,
  });
};

// ─── Issue Key ───
export const issueKey = async (data: any) => {
  return customFetch<any>("/api/keys/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};
export const useIssueKey = (options?: any) => {
  return useMutation<unknown, Error, any>({
    mutationKey: ["issueKey"],
    mutationFn: issueKey,
    ...options,
  });
};

// ─── Revoke Key ───
export const revokeKey = async ({
  id,
  encoderType,
}: {
  id: number;
  encoderType?: EncoderType;
}) => {
  return customFetch<any>(`/api/keys/${id}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: encoderType || "ip" }),
  });
};
export const useRevokeKey = (options?: any) => {
  return useMutation<unknown, Error, { id: number; encoderType?: EncoderType }>(
    {
      mutationKey: ["revokeKey"],
      mutationFn: revokeKey,
      ...options,
    },
  );
};

// ─── Smart Server: Check-In & Issue Key ───
export const smartCheckinIssueKey = async (data: {
  roomNumber: string;
  guestId: string | number;
  guestName?: string;
  arrivalDate: string;
  departureDate: string;
  checkOutTime?: string;
  workstation?: string;
  saveToDb?: boolean;
  propertyId?: number;
  roomId?: number;
  assignmentId?: number;
  cardType?: string;
  notes?: string;
}) => {
  return customFetch<{
    success: boolean;
    cardUid: string;
    workstation?: string;
    cardCount?: number;
    key?: any;
  }>("/api/encoder/smart/checkin-issue-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};
export const useSmartCheckinIssueKey = (options?: any) => {
  return useMutation<
    unknown,
    Error,
    {
      roomNumber: string;
      guestId: string | number;
      guestName?: string;
      arrivalDate: string;
      departureDate: string;
      checkOutTime?: string;
      workstation?: string;
      saveToDb?: boolean;
      propertyId?: number;
      roomId?: number;
      assignmentId?: number;
      cardType?: string;
      notes?: string;
    }
  >({
    mutationKey: ["smartCheckinIssueKey"],
    mutationFn: smartCheckinIssueKey,
    ...options,
  });
};

// ─── Audit Log ───
export const getAuditLogUrl = (propertyId: number) =>
  `/api/keys/audit?propertyId=${propertyId}`;
export const getAuditLog = async (propertyId: number) => {
  return customFetch<any[]>(getAuditLogUrl(propertyId));
};
export const useAuditLog = (propertyId: number, options?: any) => {
  return useQuery({
    queryKey: ["/api/keys/audit", propertyId],
    queryFn: () => getAuditLog(propertyId),
    enabled: !!propertyId,
    ...options,
  });
};
