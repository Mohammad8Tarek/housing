import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export function ReportTable({
  isLoading,
  allData,
  paginatedData,
  selectedRows,
  setSelectedRows,
  activeTab,
  ar,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
}: any) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44]">
            <TableHead className="w-10 px-3">
              <Checkbox
                className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-[#0F2A44]"
                checked={
                  allData.length > 0 &&
                  allData.every((r: any) => selectedRows.has(r.id))
                }
                onCheckedChange={(checked) => {
                  if (checked)
                    setSelectedRows(new Set(allData.map((r: any) => r.id)));
                  else setSelectedRows(new Set());
                }}
              />
            </TableHead>
            {activeTab === "housing" && (
              <>
                <TableHead className="text-white font-semibold">
                  Room No
                </TableHead>
                <TableHead className="text-white font-semibold">Type</TableHead>
                <TableHead className="text-white font-semibold">
                  Capacity
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Gender Policy
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Floor
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Building
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Status
                </TableHead>
              </>
            )}
            {activeTab === "employees" && (
              <>
                <TableHead className="text-white font-semibold w-10">
                  Photo
                </TableHead>
                <TableHead className="text-white font-semibold">Code</TableHead>
                <TableHead className="text-white font-semibold">
                  First Name
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Last Name
                </TableHead>
                <TableHead className="text-white font-semibold">
                  National ID
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Nationality
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Phone
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Gender
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Department
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Job Title
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Level
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Status
                </TableHead>
              </>
            )}
            {activeTab === "assignments" && (
              <>
                <TableHead className="text-white font-semibold">
                  Employee
                </TableHead>
                <TableHead className="text-white font-semibold">Room</TableHead>
                <TableHead className="text-white font-semibold">
                  Building
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Check-In
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Expected Out
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Check-Out
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Status
                </TableHead>
              </>
            )}
            {activeTab === "maintenance" && (
              <>
                <TableHead className="text-white font-semibold">
                  Category
                </TableHead>
                <TableHead className="text-white font-semibold">Room</TableHead>
                <TableHead className="text-white font-semibold">
                  Building
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Problem
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Priority
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Status
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Assigned To
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Reported By
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Reported
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Started
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Resolved
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Due Date
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Notes
                </TableHead>
              </>
            )}
            {activeTab === "hostings" && (
              <>
                <TableHead className="text-white font-semibold">
                  Host Employee
                </TableHead>
                <TableHead className="text-white font-semibold">Room</TableHead>
                <TableHead className="text-white font-semibold">Type</TableHead>
                <TableHead className="text-white font-semibold">
                  Guests
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Expected
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Actual Check
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Status
                </TableHead>
              </>
            )}
            {activeTab === "reservations" && (
              <>
                <TableHead className="text-white font-semibold">Name</TableHead>
                <TableHead className="text-white font-semibold">Room</TableHead>
                <TableHead className="text-white font-semibold">
                  Room Type
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Department
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Check-In
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Check-Out
                </TableHead>
                <TableHead className="text-white font-semibold">
                  Status
                </TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={20}
                className="py-16 text-center text-muted-foreground"
              >
                <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  No records match the selected filters
                </p>
              </TableCell>
            </TableRow>
          ) : (
            paginatedData.map((row: any, idx: number) => (
              <TableRow
                key={row.id ?? idx}
                className={
                  selectedRows.has(row.id)
                    ? "bg-primary/5"
                    : "hover:bg-muted/30"
                }
              >
                <TableCell className="px-3">
                  <Checkbox
                    checked={selectedRows.has(row.id)}
                    onCheckedChange={() => {
                      setSelectedRows((prev: any) => {
                        const next = new Set(prev);
                        next.has(row.id)
                          ? next.delete(row.id)
                          : next.add(row.id);
                        return next;
                      });
                    }}
                  />
                </TableCell>
                {activeTab === "housing" && (
                  <>
                    <TableCell className="font-mono font-medium">
                      {row.roomNumber}
                    </TableCell>
                    <TableCell>{row.roomType ?? "—"}</TableCell>
                    <TableCell>{row.capacity}</TableCell>
                    <TableCell className="capitalize">
                      {row.genderPolicy ?? "—"}
                    </TableCell>
                    <TableCell>{floorMap[row.floorId] ?? "—"}</TableCell>
                    <TableCell>{buildingMap[row.buildingId] ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </>
                )}
                {activeTab === "employees" && (
                  <>
                    <TableCell>
                      {row.photoUrl ? (
                        <img
                          src={row.photoUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {row.firstName?.[0]}
                          {row.lastName?.[0]}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-primary">
                      {row.employeeCode}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.firstName}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.nationalId ?? "—"}
                    </TableCell>
                    <TableCell>{row.nationality ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.phone ?? "—"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {row.gender ?? "—"}
                    </TableCell>
                    <TableCell>{row.department ?? "—"}</TableCell>
                    <TableCell>{row.jobTitle ?? "—"}</TableCell>
                    <TableCell>{row.level ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </>
                )}
                {activeTab === "assignments" && (
                  <>
                    <TableCell className="font-medium">
                      {empMap[row.employeeId]
                        ? `${empMap[row.employeeId].firstName} ${empMap[row.employeeId].lastName}`
                        : `Emp #${row.employeeId}`}
                    </TableCell>
                    <TableCell className="font-mono">
                      {roomMap[row.roomId]?.roomNumber ?? `#${row.roomId}`}
                    </TableCell>
                    <TableCell>
                      {roomMap[row.roomId]
                        ? (buildingMap[roomMap[row.roomId].buildingId] ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell>{row.checkInDate?.slice(0, 10)}</TableCell>
                    <TableCell>
                      {row.expectedCheckOutDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.checkOutDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </>
                )}
                {activeTab === "maintenance" && (
                  <>
                    <TableCell>{row.category ?? "—"}</TableCell>
                    <TableCell className="font-mono">
                      {roomMap[row.roomId]?.roomNumber ?? `#${row.roomId}`}
                    </TableCell>
                    <TableCell>
                      {row.roomId
                        ? (buildingMap[roomMap[row.roomId]?.buildingId] ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {row.problem ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>{row.assignedTo ?? "—"}</TableCell>
                    <TableCell>{row.reportedBy ?? "—"}</TableCell>
                    <TableCell>
                      {row.reportedDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.startedDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.resolvedDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>{row.dueDate?.slice(0, 10) ?? "—"}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs">
                      {row.notes ?? "—"}
                    </TableCell>
                  </>
                )}
                {activeTab === "hostings" && (
                  <>
                    <TableCell className="font-medium">
                      {empMap[row.employeeId]
                        ? `${empMap[row.employeeId].firstName} ${empMap[row.employeeId].lastName}`
                        : `Emp #${row.employeeId}`}
                    </TableCell>
                    <TableCell className="font-mono">
                      {roomMap[row.roomId]?.roomNumber ?? `#${row.roomId}`}
                    </TableCell>
                    <TableCell>{row.hostingType ?? "—"}</TableCell>
                    <TableCell>{row.numberOfGuests ?? "—"}</TableCell>
                    <TableCell>
                      <div>{row.expectedCheckIn?.slice(0, 10) ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        {row.expectedCheckOut?.slice(0, 10) ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{row.actualCheckIn?.slice(0, 10) ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        {row.actualCheckOut?.slice(0, 10) ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </>
                )}
                {activeTab === "reservations" && (
                  <>
                    <TableCell className="font-medium">
                      {row.firstName} {row.lastName}
                    </TableCell>
                    <TableCell className="font-mono">
                      {row.roomId
                        ? (roomMap[row.roomId]?.roomNumber ?? `#${row.roomId}`)
                        : "—"}
                    </TableCell>
                    <TableCell>{row.roomType ?? "—"}</TableCell>
                    <TableCell>{row.department ?? "—"}</TableCell>
                    <TableCell>{row.checkInDate?.slice(0, 10)}</TableCell>
                    <TableCell>
                      {row.checkOutDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
        {allData.length > 0 && (
          <tfoot>
            <tr className="bg-[#0F2A44]/90 text-[#C9A24D]">
              <td className="px-3 py-2.5 text-xs font-bold" colSpan={2}>
                {ar ? "الإجمالي" : "Total"}
              </td>
              <td className="px-3 py-2.5 text-xs font-bold" colSpan={18}>
                {allData.length}{" "}
                {activeTab === "housing"
                  ? "rooms"
                  : activeTab === "employees"
                    ? "employees"
                    : activeTab === "assignments"
                      ? "assignments"
                      : activeTab === "maintenance"
                        ? "requests"
                        : activeTab === "hostings"
                          ? "hostings"
                          : "reservations"}
                {selectedRows.size > 0 && (
                  <span className="ml-3 text-white/80">
                    · {selectedRows.size} selected
                  </span>
                )}
                {activeTab === "housing" && (
                  <span className="ml-3">
                    |{" "}
                    {allData.reduce(
                      (s: number, r: any) => s + (r.capacity ?? 0),
                      0,
                    )}{" "}
                    beds total
                  </span>
                )}
                {activeTab === "assignments" && (
                  <span className="ml-3">
                    | Active:{" "}
                    {allData.filter((a: any) => a.status === "ACTIVE").length}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </Table>
    </div>
  );
}
