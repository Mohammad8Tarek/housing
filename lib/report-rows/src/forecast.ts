// Occupancy forecast for the next 7/14/30 days (Occupancy Forecast tab).
// Shared so the API can compute it (GET /api/reports/occupancy-forecast) and
// the tab needs no stay or reservation lists. Logic moved from
// OccupancyForecastTab; days are calendar days in `timeZone` (the browser's
// own zone when omitted), so each row's movements match its label.
import { calendarDay } from "./calendar";

export interface ForecastInput {
  ar: boolean;
  rooms: any[];
  assignments: any[];
  reservations: any[];
  horizonDays: number;
  /** "all" or a building id */
  buildingId: string;
  timeZone?: string;
}

export function computeOccupancyForecast({
  ar,
  rooms = [],
  assignments = [],
  reservations = [],
  horizonDays,
  buildingId,
  timeZone,
}: ForecastInput) {
  // Filtered rooms & capacity
  const filteredRooms =
    buildingId === "all"
      ? rooms
      : rooms.filter((r: any) => r.buildingId === Number(buildingId));
  const totalCapacity = filteredRooms.reduce(
    (acc: number, r: any) => acc + (r.capacity || 1),
    0,
  );
  const activeRoomIds = new Set(filteredRooms.map((r: any) => r.id));

  // Current active assignments in filtered rooms
  const currentActiveAssignments = assignments.filter(
    (a: any) =>
      activeRoomIds.has(a.roomId) &&
      (a.status === "ACTIVE" || a.status === "VACATION"),
  );

  // Day-by-day forecast calculation
  const forecastData = [];
  let runningOccupants = currentActiveAssignments.length;

  for (let i = 0; i < horizonDays; i++) {
    const {
      iso: dIso,
      display: dateDisplay,
      dayName,
    } = calendarDay(i, ar, timeZone);

    // Expected arrivals on this day (from confirmed reservations)
    const dayArrivals = reservations.filter((r: any) => {
      if (r.status?.toUpperCase() === "CANCELLED") return false;
      if (r.roomId && !activeRoomIds.has(r.roomId)) return false;
      if (!r.checkInDate) return false;
      const inDate = String(r.checkInDate).slice(0, 10);
      return inDate === dIso;
    }).length;

    // Expected departures on this day (from active assignments due out)
    const dayDepartures = assignments.filter((a: any) => {
      if (!activeRoomIds.has(a.roomId)) return false;
      if (a.status !== "ACTIVE" && a.status !== "VACATION") return false;
      if (!a.checkOutDate) return false;
      const outDate = String(a.checkOutDate).slice(0, 10);
      return outDate === dIso;
    }).length;

    // Net change for the day
    const netMovement = dayArrivals - dayDepartures;

    // Calculate projected occupied beds
    if (i > 0) {
      runningOccupants = Math.max(0, runningOccupants + netMovement);
    }
    const projectedOccupied = Math.min(totalCapacity, runningOccupants);
    const projectedVacant = Math.max(0, totalCapacity - projectedOccupied);
    const occPercent =
      totalCapacity > 0
        ? Math.round((projectedOccupied / totalCapacity) * 100)
        : 0;

    // Demand level
    let demand = "NORMAL";
    if (occPercent >= 90) demand = "CRITICAL";
    else if (occPercent >= 75) demand = "HIGH";
    else if (occPercent < 50) demand = "LOW";

    forecastData.push({
      dayIndex: i,
      dateIso: dIso,
      dateDisplay,
      dayName,
      dayArrivals,
      dayDepartures,
      netMovement,
      projectedOccupied,
      projectedVacant,
      occPercent,
      demand,
    });
  }

  // Aggregate horizon metrics
  const aggregateMetrics = (() => {
    if (forecastData.length === 0) {
      return {
        peakOcc: 0,
        peakDate: "—",
        avgOcc: 0,
        totalArrivals: 0,
        totalDepartures: 0,
        minVacant: 0,
        netChange: 0,
      };
    }

    let maxOcc = -1;
    let maxDate = "—";
    let sumOcc = 0;
    let sumArrivals = 0;
    let sumDepartures = 0;
    let minVac = Infinity;

    forecastData.forEach((d) => {
      if (d.occPercent > maxOcc) {
        maxOcc = d.occPercent;
        maxDate = `${d.dayName} ${d.dateDisplay}`;
      }
      sumOcc += d.occPercent;
      sumArrivals += d.dayArrivals;
      sumDepartures += d.dayDepartures;
      if (d.projectedVacant < minVac) {
        minVac = d.projectedVacant;
      }
    });

    return {
      peakOcc: maxOcc,
      peakDate: maxDate,
      avgOcc: Math.round(sumOcc / forecastData.length),
      totalArrivals: sumArrivals,
      totalDepartures: sumDepartures,
      minVacant: isFinite(minVac) ? minVac : 0,
      netChange: sumArrivals - sumDepartures,
    };
  })();

  return { totalCapacity, forecastData, aggregateMetrics };
}

export type OccupancyForecast = ReturnType<typeof computeOccupancyForecast>;
