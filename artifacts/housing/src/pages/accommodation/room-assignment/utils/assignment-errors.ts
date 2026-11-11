/**
 * Maps a failed POST /api/assignments response body to a bilingual toast message.
 * Returns `undefined` when the body carries no recognised code / error, so the
 * caller keeps the original `err.message`.
 */
export function describeAssignmentError(
  body: any,
  ar: boolean,
): string | undefined {
  if (body?.code === "BED_TAKEN") {
    return (
      body.error ||
      (ar
        ? `هذا السرير مشغول بالفعل بمقيم بالسكن. ممنوع منعاً باتاً تسكين شخص فوق شخص على نفس السرير.`
        : `This bed is already occupied. Double-rooming on the same bed is strictly forbidden.`)
    );
  } else if (body?.code === "ROOM_NOT_ELIGIBLE") {
    return (
      body.error ||
      (ar
        ? "الغرفة غير صالحة للتسكين حالياً (صيانة / خارج الخدمة)."
        : "Room is not eligible.")
    );
  } else if (body?.code === "PROFILE_ALREADY_ASSIGNED") {
    return ar
      ? `الموظف مسكّن بالفعل في غرفة رقم ${body.existingRoomId}. يجب تسجيل الخروج أولاً.`
      : `Profile already assigned to room ${body.existingRoomId}. Please check out first.`;
  } else if (body?.code === "ROOM_ENTIRE_OCCUPIED") {
    return (
      body.error ||
      (ar
        ? "هذه الغرفة مخصصة بالكامل لموظف آخر (استخدام فردي) ولا يمكن تسكين أي شخص إضافي عليها."
        : "This room is reserved as an entire room for another resident.")
    );
  } else if (body?.code === "ROOM_NOT_EMPTY_FOR_ENTIRE") {
    return (
      body.error ||
      (ar
        ? "لا يمكن تخصيص الغرفة بالكامل لوجود مقيمين حاليين بها."
        : "Room already has active occupants.")
    );
  } else if (body?.code === "ROOM_FULL") {
    return ar
      ? `الغرفة وصلت للحد الأقصى لطاقتها الاستيعابية.`
      : `Room is full.`;
  } else if (body?.error) {
    return body.error;
  }
  return undefined;
}
