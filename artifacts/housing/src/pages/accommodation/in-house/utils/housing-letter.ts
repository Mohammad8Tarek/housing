import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import type { LookupMaps } from "./profile-helpers";

export async function printHousingLetterFor({
  assignment,
  emp,
  ar,
  empMap,
  roomMap,
  buildingMap,
  floorMap,
  activeProp,
  settings,
}: LookupMaps & {
  assignment: any;
  emp: any;
  ar: boolean;
  activeProp: any;
  settings: any;
}) {
  const chosenAr = ar;
  const room = roomMap[assignment.roomId];
  const building =
    assignment?.buildingName || (room ? buildingMap[room.buildingId] : null);
  const floorNum =
    assignment?.floorNumber ?? (room ? floorMap[room.floorId]?.number : null);
  const fallbackProfile = empMap[assignment.profileId] || {};
  const mergedProfile = {
    ...fallbackProfile,
    ...emp,
    id: emp?.id || fallbackProfile.id || assignment.profileId,
    profileId:
      emp?.profileId ||
      fallbackProfile.profileId ||
      assignment.profileCode ||
      assignment.profileId,
    firstName:
      emp?.firstName ||
      fallbackProfile.firstName ||
      assignment.profileFirstName,
    lastName:
      emp?.lastName || fallbackProfile.lastName || assignment.profileLastName,
    firstNameAr:
      emp?.firstNameAr ||
      fallbackProfile.firstNameAr ||
      assignment.profileFirstNameAr,
    lastNameAr:
      emp?.lastNameAr ||
      fallbackProfile.lastNameAr ||
      assignment.profileLastNameAr,
    thirdNameAr:
      emp?.thirdNameAr ||
      fallbackProfile.thirdNameAr ||
      assignment.profileThirdNameAr,
    fourthNameAr:
      emp?.fourthNameAr ||
      fallbackProfile.fourthNameAr ||
      assignment.profileFourthNameAr,
    nationalId:
      emp?.nationalId ||
      fallbackProfile.nationalId ||
      assignment.profileNationalId,
    nationality:
      emp?.nationality ||
      fallbackProfile.nationality ||
      assignment.profileNationality,
    department:
      emp?.department ||
      fallbackProfile.department ||
      assignment.profileDepartment,
    departmentAr:
      emp?.departmentAr ||
      fallbackProfile.departmentAr ||
      assignment.profileDepartmentAr,
    jobTitle:
      emp?.jobTitle ||
      fallbackProfile.jobTitle ||
      assignment.profileJobTitle ||
      (assignment as any).jobTitle,
    jobTitleAr:
      emp?.jobTitleAr ||
      fallbackProfile.jobTitleAr ||
      assignment.profileJobTitleAr,
    level: emp?.level || fallbackProfile.level || assignment.profileLevel,
    phone: emp?.phone || fallbackProfile.phone || assignment.profilePhone,
  };
  await generateHousingLetterPdf({
    isArabic: chosenAr,
    profile: mergedProfile,
    assignment,
    room,
    building,
    floorNum,
    propName: activeProp?.name || "",
    propNameAr: (activeProp as any)?.displayName || activeProp?.name || "",
    propAddress: (activeProp as any)?.address || "",
    systemLogoUrl: (settings as any)?.systemLogo,
    propLogoUrl: (activeProp as any)?.logo,
  });
}
