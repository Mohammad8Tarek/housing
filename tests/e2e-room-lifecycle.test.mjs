// ============================================================================
// Room Lifecycle & Accommodation Integration Suite (AGENTS.md Rule 5 / Rule 6)
//
// Runs against a REAL api-server + PostgreSQL. It creates its own building,
// floor, rooms and profiles (prefixed E2E-) inside the target property and
// walks the full state machine through the public HTTP API:
//
//   available -> occupied -> dirty -> available
//   occupied  -> occupied_vacation -> occupied (vacation / return)
//   bed double-booking, capacity and entire-room guards (HTTP 409)
//   bed transfer between rooms
//   reservation -> check-in
//   cross-property check-in (profile from another property)
//
// Usage:
//   API_URL=http://localhost:4000 ADMIN_USER=admin ADMIN_PASS=... PROPERTY_ID=1 \
//     node --test tests/e2e-room-lifecycle.test.mjs
//
// The suite skips itself (exit 0) when the API is not reachable, so it is safe
// in CI jobs that have no database.
// ============================================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/+$/, "");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Test@12345";
const PROPERTY_ID = Number(process.env.PROPERTY_ID || 1);
const SOURCE_PROPERTY_ID = Number(process.env.SOURCE_PROPERTY_ID || 2);

const RUN = Date.now().toString(36).toUpperCase();
const today = new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

let cookie = "";
let apiUp = false;
const created = { building: null, floor: null, rooms: [], profiles: [], assignments: [], reservations: [] };

async function api(method, path, body, { property = PROPERTY_ID } = {}) {
  const url = new URL(API_URL + "/api" + path);
  if (property && !url.searchParams.has("propertyId")) url.searchParams.set("propertyId", String(property));
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

async function room(id) {
  const r = await api("GET", `/rooms/${id}`);
  assert.equal(r.status, 200, `GET /rooms/${id} -> ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json.data ?? r.json;
}

async function profile(id) {
  const r = await api("GET", `/profiles/${id}`);
  assert.equal(r.status, 200, `GET /profiles/${id} -> ${r.status}`);
  return r.json.data ?? r.json;
}


/** There is no GET /assignments/:id — look the row up in the in-house list, then in history. */
async function findAssignment(id) {
  for (const path of ["/assignments/in-house", "/assignments/history"]) {
    const r = await api("GET", `${path}?limit=500&page=1`);
    assert.equal(r.status, 200, `GET ${path} -> ${r.status}`);
    const rows = r.json.data ?? r.json;
    const hit = (Array.isArray(rows) ? rows : []).find((a) => Number(a.id) === Number(id));
    if (hit) return hit;
  }
  return null;
}

async function createRoom(roomNumber, capacity, roomType = "Standard") {
  const r = await api("POST", "/rooms", {
    propertyId: PROPERTY_ID,
    buildingId: created.building.id,
    floorId: created.floor.id,
    roomNumber,
    roomType,
    capacity,
    status: "available",
  });
  assert.equal(r.status, 201, `create room ${roomNumber}: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const row = r.json.data ?? r.json;
  created.rooms.push(row);
  return row;
}

// `level` decides which room sizes the housing policy allows (level 1 -> 1 bed,
// 2 -> 2 beds, 3 -> 3 beds with the default settings), so each test uses a
// resident that fits its room and the policy does not get in the way.
async function createProfile(suffix, property = PROPERTY_ID, level = "1") {
  const code = `E2E-${RUN}-${suffix}`;
  const r = await api(
    "POST",
    "/profiles",
    {
      propertyId: property,
      profileId: code,
      firstName: "E2E",
      lastName: suffix,
      nationalId: `2${String(Date.now()).slice(-9)}${String(created.profiles.length).padStart(4, "0")}`,
      nationality: "Egyptian",
      address: "Test",
      jobTitle: "Waiter",
      level,
      phone: `01${String(Date.now()).slice(-6)}${String(created.profiles.length).padStart(3, "0")}`,
      department: "F&B",
      hireDate: today,
      gender: "M",
      status: "ACTIVE",
    },
    { property },
  );
  assert.equal(r.status, 201, `create profile ${code}: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const row = r.json.data ?? r.json;
  created.profiles.push({ ...row, _property: property });
  return row;
}

async function checkIn(profileId, roomId, extra = {}) {
  const r = await api("POST", "/assignments", {
    propertyId: PROPERTY_ID,
    profileId,
    roomId,
    checkInDate: today,
    ...extra,
  });
  if (r.status === 201) created.assignments.push(r.json.data ?? r.json);
  return r;
}

async function checkOut(assignmentId) {
  return api("POST", `/assignments/${assignmentId}/checkout`, {
    checkOutDate: today,
    checkOutReason: "end_of_contract",
    notes: "e2e",
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────
before(async () => {
  try {
    const health = await fetch(API_URL + "/api/health").catch(() => null);
    apiUp = Boolean(health);
  } catch {
    apiUp = false;
  }
  if (!apiUp) {
    console.log(`[e2e-room-lifecycle] API not reachable at ${API_URL} — skipping suite`);
    return;
  }

  const login = await api("POST", "/auth/login", { username: ADMIN_USER, password: ADMIN_PASS }, { property: 0 });
  assert.equal(login.status, 200, `login failed: ${JSON.stringify(login.json).slice(0, 200)}`);
  const setCookie = login.headers.get("set-cookie") || "";
  cookie = setCookie.split(/,(?=[^ ]+=)/).map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookie, "no session cookie returned by login");

  const b = await api("POST", "/buildings", {
    propertyId: PROPERTY_ID,
    name: `E2E Building ${RUN}`,
    location: "e2e",
    capacity: 50,
    status: "active",
  });
  assert.equal(b.status, 201, `create building: ${b.status} ${JSON.stringify(b.json).slice(0, 300)}`);
  created.building = b.json.data ?? b.json;

  const f = await api("POST", "/floors", {
    propertyId: PROPERTY_ID,
    buildingId: created.building.id,
    floorNumber: "1",
    description: "e2e",
  });
  assert.equal(f.status, 201, `create floor: ${f.status} ${JSON.stringify(f.json).slice(0, 300)}`);
  created.floor = f.json.data ?? f.json;
});

// ─── Tests ───────────────────────────────────────────────────────────────────
test("check-in marks the room occupied and the assignment ACTIVE", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-101`, 2);
  const p = await createProfile("A", PROPERTY_ID, "2");

  const res = await checkIn(p.id, r.id, { bedNumber: 1 });
  assert.equal(res.status, 201, JSON.stringify(res.json).slice(0, 300));
  const a = res.json.data ?? res.json;
  assert.equal(a.status, "ACTIVE");
  assert.equal(a.bedNumber, 1);

  const after1 = await room(r.id);
  assert.equal(after1.status, "occupied");
  assert.equal(after1.currentOccupancy, 1);
});

test("the same bed cannot be double-booked (409)", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-102`, 2);
  const p1 = await createProfile("B1", PROPERTY_ID, "2");
  const p2 = await createProfile("B2", PROPERTY_ID, "2");

  assert.equal((await checkIn(p1.id, r.id, { bedNumber: 1 })).status, 201);
  const dup = await checkIn(p2.id, r.id, { bedNumber: 1 });
  assert.equal(dup.status, 409, `expected 409 for bed double-booking, got ${dup.status}`);

  // second bed is still free
  const ok = await checkIn(p2.id, r.id, { bedNumber: 2 });
  assert.equal(ok.status, 201, JSON.stringify(ok.json).slice(0, 300));
  assert.equal((await room(r.id)).currentOccupancy, 2);
});

test("room capacity is enforced (409 when full)", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-103`, 1);
  const p1 = await createProfile("C1");
  const p2 = await createProfile("C2");

  assert.equal((await checkIn(p1.id, r.id, { bedNumber: 1 })).status, 201);
  // No bed chosen: the room itself is full (a bed number beyond the room's
  // beds is refused separately as INVALID_BED).
  const full = await checkIn(p2.id, r.id);
  assert.equal(full.status, 409, `expected 409 when room is full, got ${full.status}`);
});

test("entire-room booking is refused while someone lives there and fills the room when granted", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-104`, 3);
  const p1 = await createProfile("D1", PROPERTY_ID, "3");
  const p2 = await createProfile("D2", PROPERTY_ID, "3");

  assert.equal((await checkIn(p1.id, r.id, { bedNumber: 1 })).status, 201);
  const refused = await checkIn(p2.id, r.id, { isEntireRoom: true });
  assert.equal(refused.status, 409, `expected 409 entire-room on occupied room, got ${refused.status}`);

  const r2 = await createRoom(`${RUN}-105`, 3);
  // A level-3 resident is not entitled to a whole room by policy: the admin
  // grants it as an approved exception.
  const whole = await checkIn(p2.id, r2.id, {
    isEntireRoom: true,
    hasPolicyException: true,
    policyExceptionReason: "e2e: whole room granted",
  });
  assert.equal(whole.status, 201, JSON.stringify(whole.json).slice(0, 300));
  const after = await room(r2.id);
  assert.equal(after.status, "occupied");
  assert.equal(after.currentOccupancy, after.capacity, "entire-room booking must consume the full capacity");

  const third = await createProfile("D3", PROPERTY_ID, "3");
  const blocked = await checkIn(third.id, r2.id, { bedNumber: 2 });
  assert.equal(blocked.status, 409, `entire-room must block further check-ins, got ${blocked.status}`);
});

test("checkout releases the bed, sets the room dirty, and cleaning returns it to available", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-106`, 1);
  const p = await createProfile("E");
  const a = (await checkIn(p.id, r.id, { bedNumber: 1 })).json;
  const assignment = a.data ?? a;

  const out = await checkOut(assignment.id);
  assert.equal(out.status, 200, JSON.stringify(out.json).slice(0, 300));

  const dirty = await room(r.id);
  assert.equal(dirty.status, "dirty", "room must become dirty after the last occupant leaves");
  assert.equal(dirty.currentOccupancy, 0);

  const got = await findAssignment(assignment.id);
  assert.ok(got, "checked-out assignment must appear in history");
  assert.equal(got.status, "CHECKED_OUT");

  const clean = await api("PATCH", `/rooms/${r.id}/status`, { status: "available" });
  assert.equal(clean.status, 200, JSON.stringify(clean.json).slice(0, 300));
  assert.equal((await room(r.id)).status, "available");
});

test("checkout of one occupant in a shared room yields occupied_dirty", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-107`, 2);
  const p1 = await createProfile("F1", PROPERTY_ID, "2");
  const p2 = await createProfile("F2", PROPERTY_ID, "2");
  const a1 = (await checkIn(p1.id, r.id, { bedNumber: 1 })).json;
  assert.equal((await checkIn(p2.id, r.id, { bedNumber: 2 })).status, 201);

  assert.equal((await checkOut((a1.data ?? a1).id)).status, 200);
  const after = await room(r.id);
  assert.equal(after.status, "occupied_dirty");
  assert.equal(after.currentOccupancy, 1);

  const clean = await api("PATCH", `/rooms/${r.id}/status`, { status: "occupied" });
  assert.equal(clean.status, 200);
  assert.equal((await room(r.id)).status, "occupied");
});

test("vacation keeps the assignment active and flips the room to occupied_vacation, return restores occupied", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const r = await createRoom(`${RUN}-108`, 1);
  const p = await createProfile("G");
  const a = (await checkIn(p.id, r.id, { bedNumber: 1 })).json;
  const assignment = a.data ?? a;

  const vac = await api("POST", `/profiles/${p.id}/vacation`, { startDate: today, endDate: plusDays(7), notes: "e2e" });
  assert.equal(vac.status, 200, JSON.stringify(vac.json).slice(0, 300));

  assert.equal((await room(r.id)).status, "occupied_vacation");
  assert.equal((await profile(p.id)).status, "VACATION");
  const got = await findAssignment(assignment.id);
  assert.equal(got?.status, "ACTIVE", "vacation must not terminate the assignment");

  const back = await api("POST", `/profiles/${p.id}/return-vacation`, { returnDate: today });
  assert.equal(back.status, 200, JSON.stringify(back.json).slice(0, 300));
  assert.equal((await room(r.id)).status, "occupied");
  assert.equal((await profile(p.id)).status, "ACTIVE");
});

test("bed transfer moves occupancy from the old room to the new room", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const from = await createRoom(`${RUN}-109`, 1);
  const to = await createRoom(`${RUN}-110`, 1);
  const p = await createProfile("H");
  const a = (await checkIn(p.id, from.id, { bedNumber: 1 })).json;
  const assignment = a.data ?? a;

  const tr = await api("POST", `/assignments/${assignment.id}/transfer`, {
    newRoomId: to.id,
    newBedNumber: 1,
    transferReason: "e2e",
    transferDate: today,
  });
  assert.equal(tr.status, 200, JSON.stringify(tr.json).slice(0, 300));

  const oldRoom = await room(from.id);
  const newRoom = await room(to.id);
  assert.equal(oldRoom.currentOccupancy, 0, "old room must be released");
  assert.notEqual(oldRoom.status, "occupied");
  assert.equal(newRoom.status, "occupied");
  assert.equal(newRoom.currentOccupancy, 1);

  // the new room cannot accept another occupant now
  const other = await createProfile("H2");
  assert.equal((await checkIn(other.id, to.id, { bedNumber: 1 })).status, 409);
});

test("transfer into an out-of-service room is refused", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const from = await createRoom(`${RUN}-111`, 1);
  const oos = await createRoom(`${RUN}-112`, 1);
  assert.equal((await api("PATCH", `/rooms/${oos.id}/status`, { status: "out_of_service" })).status, 200);
  const p = await createProfile("I");
  const a = (await checkIn(p.id, from.id, { bedNumber: 1 })).json;

  const tr = await api("POST", `/assignments/${(a.data ?? a).id}/transfer`, {
    newRoomId: oos.id,
    newBedNumber: 1,
    transferDate: today,
  });
  assert.equal(tr.status, 400, `expected 400 for OOS room, got ${tr.status}`);
  assert.equal((await room(from.id)).currentOccupancy, 1, "failed transfer must not touch the source room");
});

test("reservation check-in creates the assignment and occupies the room", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  // A reservation guest has no level (general staff: 4-bed rooms by policy).
  const r = await createRoom(`${RUN}-113`, 4);
  const res = await api("POST", "/reservations", {
    propertyId: PROPERTY_ID,
    roomId: r.id,
    roomType: "Standard",
    firstName: "E2E",
    lastName: `Res${RUN}`,
    checkInDate: today,
    checkOutDate: plusDays(30),
    guestIdCardNumber: `3${String(Date.now()).slice(-12)}`,
    guestPhone: "01000000001",
    jobTitle: "Cook",
    department: "Kitchen",
    notes: "e2e",
  });
  assert.equal(res.status, 201, JSON.stringify(res.json).slice(0, 300));
  const reservation = res.json.data ?? res.json;
  created.reservations.push(reservation);
  assert.equal(reservation.status, "UPCOMING");

  const ci = await api("POST", `/reservations/${reservation.id}/checkin`, { roomId: r.id, actualCheckInDate: today });
  assert.ok([200, 201].includes(ci.status), JSON.stringify(ci.json).slice(0, 300));
  // Check-in creates its own stay and resident profile; track them for cleanup.
  if (ci.json?.assignment?.id) created.assignments.push(ci.json.assignment);
  if (ci.json?.profile?.id) created.profiles.push({ ...ci.json.profile, _property: PROPERTY_ID });

  const after = await room(r.id);
  assert.equal(after.status, "occupied");
  assert.equal(after.currentOccupancy, 1);

  const again = await api("POST", `/reservations/${reservation.id}/checkin`, { roomId: r.id, actualCheckInDate: today });
  assert.ok(again.status >= 400, "a reservation cannot be checked in twice");
});

test("housing policy is enforced by the server and exceptions are recorded", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  // Level 1 is entitled to a single room; a 2-bed room breaks the policy.
  const r = await createRoom(`${RUN}-115`, 2);
  const p = await createProfile("P", PROPERTY_ID, "1");

  const refused = await checkIn(p.id, r.id);
  assert.equal(refused.status, 409, JSON.stringify(refused.json).slice(0, 300));
  assert.equal(refused.json.code, "POLICY_VIOLATION");
  assert.ok(refused.json.violations?.length > 0, "violations must be listed");

  const noReason = await checkIn(p.id, r.id, { hasPolicyException: true, policyExceptionReason: "x" });
  assert.equal(noReason.status, 400, "an exception needs a real reason");

  const granted = await checkIn(p.id, r.id, {
    hasPolicyException: true,
    policyExceptionReason: "e2e: approved exception",
    policyApprovedBy: "someone typed this",
  });
  assert.equal(granted.status, 201, JSON.stringify(granted.json).slice(0, 300));
  const a = granted.json.data ?? granted.json;
  // The server writes the approval into the stay's notes: rules broken,
  // the signed-in user as approver (never the typed name) and the reason.
  assert.ok(
    a.notes.includes(`معتمد من: ${ADMIN_USER}]`) && a.notes.includes("e2e: approved exception"),
    `exception not recorded: ${a.notes}`,
  );
  assert.ok(!a.notes.includes("someone typed this"), "the typed approver name must be ignored");
});

test("cross-property check-in brings the profile into the target property (Rule 6)", async (t) => {
  if (!apiUp) return t.skip("API not reachable");
  const src = await api("GET", `/properties`, undefined, { property: 0 });
  const list = Array.isArray(src.json) ? src.json : src.json?.data ?? [];
  const hasSource = list.some((p) => Number(p.id) === SOURCE_PROPERTY_ID);
  if (!hasSource) {
    console.log(`[e2e-room-lifecycle] source property ${SOURCE_PROPERTY_ID} not found — skipping cross-property case`);
    return;
  }

  const foreign = await createProfile("X", SOURCE_PROPERTY_ID);
  const r = await createRoom(`${RUN}-114`, 1);

  const res = await api("POST", "/assignments", {
    propertyId: PROPERTY_ID,
    profileId: foreign.id,
    roomId: r.id,
    bedNumber: 1,
    checkInDate: today,
    sourcePropertyId: SOURCE_PROPERTY_ID,
    archiveSourceProfile: true,
    checkoutPreviousAssignment: true,
  });
  assert.equal(res.status, 201, JSON.stringify(res.json).slice(0, 400));
  const a = res.json.data ?? res.json;
  created.assignments.push(a);
  // The profile is copied into the target property under a new id.
  if (a.profileId) created.profiles.push({ id: a.profileId, _property: PROPERTY_ID });
  assert.equal(a.status, "ACTIVE");
  assert.equal((await room(r.id)).status, "occupied");

  // The occupant now resolves inside the target property
  const local = await profile(a.profileId);
  assert.equal(local.profileId, foreign.profileId);
});

// ─── Cleanup (best effort) ───────────────────────────────────────────────────
after(async () => {
  if (!apiUp) return;
  const ids = created.assignments.map((a) => a.id).filter(Boolean);
  // bulk-delete skips ACTIVE stays, which would then block deleting the
  // rooms/profiles below — check every test stay out first.
  for (const id of ids) await checkOut(id).catch(() => {});
  if (ids.length) await api("POST", "/assignments/bulk-delete", { ids }).catch(() => {});
  for (const p of created.profiles) await api("DELETE", `/profiles/${p.id}`, undefined, { property: p._property }).catch(() => {});
  for (const r of created.reservations) await api("DELETE", `/reservations/${r.id}`).catch(() => {});
  for (const r of created.rooms) await api("DELETE", `/rooms/${r.id}`).catch(() => {});
  if (created.floor) await api("DELETE", `/floors/${created.floor.id}`).catch(() => {});
  if (created.building) await api("DELETE", `/buildings/${created.building.id}`).catch(() => {});
});
