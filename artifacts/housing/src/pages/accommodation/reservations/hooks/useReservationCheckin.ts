import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useCheckinReservation } from "@workspace/api-client-react";
import { recommendBestRooms, checkPolicyCompliance } from "@/lib/room-recommender";
import { type PolicyViolationItem } from "@/components/PolicyExceptionApprovalModal";
import { type ProfileResult } from "../../shared/profile-search";
import type { CheckinDialogState, Setter } from "../types";
import { isRoomBookable } from "../utils";

interface UseReservationCheckinArgs {
  ar: boolean;
  activePropertyId: number | string | null | undefined;
  rooms: any[];
  allAssignments: any[];
  profilesList: any[];
  settings: any;
  invalidate: () => void;
  setSelectedProfile: Setter<ProfileResult | null>;
  setLastAssignment: Setter<any>;
  setKeyPromptOpen: Setter<boolean>;
  setSelectedRows: Setter<Set<number>>;
}

/** Check-in flow for an UPCOMING reservation: room picker dialog, policy check, mutation. */
export function useReservationCheckin({
  ar, activePropertyId, rooms, allAssignments, profilesList, settings, invalidate,
  setSelectedProfile, setLastAssignment, setKeyPromptOpen, setSelectedRows,
}: UseReservationCheckinArgs) {
  const [checkinDialog, setCheckinDialog] = useState<CheckinDialogState>({ open: false, id: null });
  const [checkinRoomId, setCheckinRoomId] = useState("");
  const [checkinRoomSearch, setCheckinRoomSearch] = useState("");
  const [resPolicyModal, setResPolicyModal] = useState<{
    open: boolean;
    violations: PolicyViolationItem[];
    pendingAction?: (approval: { approvedBy: string; reason: string }) => void;
  }>({ open: false, violations: [] });

  const checkinRooms = rooms.filter((r: any) => isRoomBookable(r));

  const checkinRecommendations = useMemo(() => {
    if (!checkinDialog.open || !checkinDialog.reservation || rooms.length === 0) {
      return { bestRoom: null, scoredRooms: [], recommendedMap: {} as Record<number, any> };
    }
    const res = checkinDialog.reservation;
    return recommendBestRooms({
      profile: {
        level: res.level,
        gender: res.gender,
        department: res.department,
        nationality: res.nationality,
      },
      rooms: checkinRooms,
      assignments: allAssignments,
      profiles: profilesList,
      policySettings: settings || {},
    });
  }, [checkinDialog.open, checkinDialog.reservation, checkinRooms, allAssignments, profilesList, settings]);

  const filteredCheckinRooms = useMemo(() => {
    const list = checkinRooms.filter((r: any) => !checkinRoomSearch.trim() || r.roomNumber?.toLowerCase().includes(checkinRoomSearch.toLowerCase()));
    return list.sort((a: any, b: any) => {
      const scoreA = checkinRecommendations.recommendedMap[a.id]?.score ?? 0;
      const scoreB = checkinRecommendations.recommendedMap[b.id]?.score ?? 0;
      return scoreB - scoreA;
    });
  }, [checkinRooms, checkinRoomSearch, checkinRecommendations]);

  const checkinMutation = useCheckinReservation({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        toast.success(
          ar
            ? "تم التسكين بنجاح وانتقل الحجز إلى قائمة المقيمين"
            : "Checked in successfully and moved to In-House",
        );
        setSelectedRows((prev) => {
          const next = new Set(prev);
          if (checkinDialog.id) next.delete(checkinDialog.id);
          return next;
        });
        setCheckinDialog({ open: false, id: null });
        setCheckinRoomId("");

        const asgn = data?.assignment || {
          id: data?.assignmentId || data?.id,
          roomId: data?.roomId,
          checkInDate: data?.checkInDate,
          expectedCheckOutDate: data?.checkOutDate,
        };
        setLastAssignment(asgn);
        if (data?.profile) {
          setSelectedProfile(data.profile);
        }
        setKeyPromptOpen(true);
      },
      onError: (e: any) => {
        const msg = e?.data?.error || e?.message || (ar ? "خطأ في التسكين" : "Check-in error");
        toast.error(msg);
      },
    },
  });

  const executeCheckinOperation = (
    res: any,
    targetRoomId: number,
    approval?: { approvedBy: string; reason: string },
  ) => {
    setSelectedProfile({
      id: res.profileId || 0,
      propertyId: typeof activePropertyId === "number" ? activePropertyId : (res.propertyId || 0),
      propertyName: null,
      profileId: res.profileCode || `RES-${res.id}`,
      firstName: res.firstName,
      lastName: res.lastName,
      nationalId: res.guestIdCardNumber || "",
      jobTitle: res.jobTitle || null,
      department: res.department || null,
      nationality: res.nationality || null,
      phone: res.guestPhone || null,
      level: res.level || null,
      status: "ACTIVE",
      gender: res.gender || null,
    });

    checkinMutation.mutate({
      id: res.id,
      data: {
        roomId: targetRoomId,
        actualCheckInDate: new Date().toISOString(),
        hasPolicyException: Boolean(approval),
        policyApprovedBy: approval?.approvedBy,
        policyExceptionReason: approval?.reason,
      } as any,
    });
    setCheckinDialog({ open: false, id: null });
  };

  const handleStartCheckin = (res: any) => {
    if (res.roomId) {
      const chosenRoom = rooms.find((r: any) => r.id === Number(res.roomId));
      if (chosenRoom) {
        const compliance = checkPolicyCompliance({
          profile: {
            level: res.level,
            gender: res.gender,
            department: res.department,
            nationality: res.nationality,
          },
          room: chosenRoom,
          assignments: allAssignments,
          profiles: profilesList,
          policySettings: settings || {},
        });

        if (
          !compliance.compliant &&
          compliance.violations.length > 0 &&
          (settings as any)?.policyRequireExceptionApproval
        ) {
          setResPolicyModal({
            open: true,
            violations: compliance.violations,
            pendingAction: (approval) => {
              executeCheckinOperation(res, Number(res.roomId), approval);
            },
          });
          return;
        }
      }

      executeCheckinOperation(res, Number(res.roomId));
    } else {
      // No room was assigned yet: open room picker dialog
      setCheckinRoomId("");
      setCheckinDialog({
        open: true,
        id: res.id,
        guestName: `${res.firstName} ${res.lastName}`,
        reservation: res,
      });
    }
  };

  const handleCheckin = () => {
    if (!checkinDialog.id || !checkinRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة" : "Please select a room");
      return;
    }
    const res = checkinDialog.reservation;
    const targetRoomId = parseInt(checkinRoomId);
    const chosenRoom = rooms.find((r: any) => r.id === targetRoomId);

    if (chosenRoom && res) {
      const compliance = checkPolicyCompliance({
        profile: {
          level: res.level,
          gender: res.gender,
          department: res.department,
          nationality: res.nationality,
        },
        room: chosenRoom,
        assignments: allAssignments,
        profiles: profilesList,
        policySettings: settings || {},
      });

      if (
        !compliance.compliant &&
        compliance.violations.length > 0 &&
        (settings as any)?.policyRequireExceptionApproval
      ) {
        setResPolicyModal({
          open: true,
          violations: compliance.violations,
          pendingAction: (approval) => {
            executeCheckinOperation(res, targetRoomId, approval);
          },
        });
        return;
      }
    }

    executeCheckinOperation(res, targetRoomId);
  };

  return {
    checkinDialog, setCheckinDialog,
    checkinRoomId, setCheckinRoomId,
    checkinRoomSearch, setCheckinRoomSearch,
    resPolicyModal, setResPolicyModal,
    checkinRecommendations, filteredCheckinRooms,
    checkinMutation,
    handleStartCheckin, handleCheckin,
  };
}
