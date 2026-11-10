// Guest hosting: bulk action bar.
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import type { GuestHostingState } from "./useGuestHostingState";

export function renderHostingBulkBar(s: GuestHostingState) {
  const { can, ar, checkoutMutation, deleteMutation, selectedRows, setSelectedRows, exportHostExcel } = s;
  return (
<BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={can("guest_hosting", "export") ? exportHostExcel : undefined}
        ar={ar}
        actions={[
          ...(can("guest_hosting", "checkout")
            ? [
                {
                  label: ar ? "تسجيل خروج المحدد" : "Check-out Selected",
                  variant: "default" as const,
                  onClick: () => {
                    if (
                      window.confirm(
                        ar
                          ? `هل تريد تسجيل خروج ${selectedRows.size} استضافة محددة؟`
                          : `Check out ${selectedRows.size} selected hostings?`,
                      )
                    ) {
                      selectedRows.forEach((id) =>
                        checkoutMutation.mutate({ id }),
                      );
                      setSelectedRows(new Set());
                    }
                  },
                },
              ]
            : []),
          ...(can("guest_hosting", "delete")
            ? [
                {
                  label: ar ? "حذف المحدد" : "Delete Selected",
                  variant: "destructive" as const,
                  onClick: () => {
                    if (
                      window.confirm(
                        ar
                          ? `هل تريد بالتأكيد حذف ${selectedRows.size} سجل استضافة محدد؟`
                          : `Are you sure you want to delete ${selectedRows.size} selected hosting records?`,
                      )
                    ) {
                      selectedRows.forEach((id) =>
                        deleteMutation.mutate({ id }),
                      );
                      setSelectedRows(new Set());
                    }
                  },
                },
              ]
            : []),
        ]}
      />
  );
}
