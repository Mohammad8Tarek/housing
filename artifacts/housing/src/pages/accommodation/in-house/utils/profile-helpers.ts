/**
 * Builds the profile object used for display: the full profile record when
 * loaded, otherwise the denormalised profile fields carried on the assignment.
 */
export function buildProfileObj(a: any, emp: any) {
  return (
    emp || {
      id: a.profileId,
      firstName: a.profileFirstName,
      lastName: a.profileLastName,
      firstNameAr: a.profileFirstNameAr,
      lastNameAr: a.profileLastNameAr,
      thirdNameAr: a.profileThirdNameAr,
      fourthNameAr: a.profileFourthNameAr,
      jobTitle: a.profileJobTitle || (a as any).jobTitle,
      jobTitleAr: a.profileJobTitleAr,
      department: a.profileDepartment,
      departmentAr: a.profileDepartmentAr,
    }
  );
}

export type LookupMaps = {
  empMap: Record<string, any>;
  roomMap: Record<string, any>;
  buildingMap: Record<string, any>;
  floorMap: Record<string, { name: any; number: any }>;
};
