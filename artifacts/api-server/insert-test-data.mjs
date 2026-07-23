import { db } from "@workspace/db";
import {
  employeesTable,
  employeePortalAccountsTable,
  buildingsTable,
  floorsTable,
  roomsTable,
  assignmentsTable,
  maintenanceTable,
  activitiesTable,
  activityRegistrationsTable,
  evaluationsTable,
  portalDocumentsTable,
  portalContactsTable,
  portalNotificationsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "employee123";

async function insertTestData() {
  try {
    console.log("🔄 Starting test data insertion...\n");

    // 1. Insert Employees
    console.log("📝 Inserting employees...");
    const employees = await db.insert(employeesTable).values([
      {
        employeeId: "EMP001",
        firstName: "Ahmed",
        lastName: "Mohamed",
        email: "ahmed.m@company.com",
        phone: "+966501234567",
        jobTitle: "Software Engineer",
        department: "IT",
        status: "ACTIVE",
        hireDate: new Date("2023-01-15"),
        photoUrl: "https://i.pravatar.cc/150?img=1",
      },
      {
        employeeId: "EMP002",
        firstName: "Fatima",
        lastName: "Ali",
        email: "fatima.a@company.com",
        phone: "+966502345678",
        jobTitle: "Product Manager",
        department: "Product",
        status: "ACTIVE",
        hireDate: new Date("2023-02-20"),
        photoUrl: "https://i.pravatar.cc/150?img=2",
      },
      {
        employeeId: "EMP003",
        firstName: "Mohammed",
        lastName: "Hassan",
        email: "mohammed.h@company.com",
        phone: "+966503456789",
        jobTitle: "HR Specialist",
        department: "HR",
        status: "ACTIVE",
        hireDate: new Date("2022-11-10"),
        photoUrl: "https://i.pravatar.cc/150?img=3",
      },
      {
        employeeId: "EMP004",
        firstName: "Noor",
        lastName: "Abdullah",
        email: "noor.a@company.com",
        phone: "+966504567890",
        jobTitle: "Sales Executive",
        department: "Sales",
        status: "ACTIVE",
        hireDate: new Date("2023-03-05"),
        photoUrl: "https://i.pravatar.cc/150?img=4",
      },
      {
        employeeId: "EMP005",
        firstName: "Layla",
        lastName: "Omar",
        email: "layla.o@company.com",
        phone: "+966505678901",
        jobTitle: "Finance Manager",
        department: "Finance",
        status: "ACTIVE",
        hireDate: new Date("2022-08-01"),
        photoUrl: "https://i.pravatar.cc/150?img=5",
      },
      {
        employeeId: "EMP006",
        firstName: "Karim",
        lastName: "Khalid",
        email: "karim.k@company.com",
        phone: "+966506789012",
        jobTitle: "Operations Lead",
        department: "Operations",
        status: "ACTIVE",
        hireDate: new Date("2023-04-12"),
        photoUrl: "https://i.pravatar.cc/150?img=6",
      },
      {
        employeeId: "EMP007",
        firstName: "Amira",
        lastName: "Ibrahim",
        email: "amira.i@company.com",
        phone: "+966507890123",
        jobTitle: "Designer",
        department: "Design",
        status: "ACTIVE",
        hireDate: new Date("2023-05-18"),
        photoUrl: "https://i.pravatar.cc/150?img=7",
      },
    ]).returning();

    console.log(`✅ Inserted ${employees.length} employees\n`);

    // 2. Insert Portal Accounts
    console.log("🔐 Inserting portal accounts...");
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const accounts = await db
      .insert(employeePortalAccountsTable)
      .values(
        employees.map((emp) => ({
          employeeId: emp.employeeId,
          passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          failedAttempts: 0,
          mustChangePassword: false,
        }))
      )
      .returning();

    console.log(`✅ Inserted ${accounts.length} portal accounts\n`);
    console.log(`🔑 Default password for all accounts: "${DEFAULT_PASSWORD}"\n`);

    // 3. Insert Buildings
    console.log("🏢 Inserting buildings...");
    const buildings = await db
      .insert(buildingsTable)
      .values([
        {
          name: "Building A - North Wing",
          location: "Riyadh North",
          numberOfFloors: 5,
          status: "ACTIVE",
        },
        {
          name: "Building B - South Wing",
          location: "Riyadh South",
          numberOfFloors: 4,
          status: "ACTIVE",
        },
        {
          name: "Building C - East Wing",
          location: "Riyadh East",
          numberOfFloors: 6,
          status: "ACTIVE",
        },
      ])
      .returning();

    console.log(`✅ Inserted ${buildings.length} buildings\n`);

    // 4. Insert Floors
    console.log("📐 Inserting floors...");
    const floors = await db
      .insert(floorsTable)
      .values([
        { buildingId: buildings[0].id, floorNumber: 1, description: "Ground Floor" },
        { buildingId: buildings[0].id, floorNumber: 2, description: "First Floor" },
        { buildingId: buildings[0].id, floorNumber: 3, description: "Second Floor" },
        { buildingId: buildings[0].id, floorNumber: 4, description: "Third Floor" },
        { buildingId: buildings[0].id, floorNumber: 5, description: "Fourth Floor" },
        { buildingId: buildings[1].id, floorNumber: 1, description: "Ground Floor" },
        { buildingId: buildings[1].id, floorNumber: 2, description: "First Floor" },
        { buildingId: buildings[1].id, floorNumber: 3, description: "Second Floor" },
        { buildingId: buildings[1].id, floorNumber: 4, description: "Third Floor" },
        { buildingId: buildings[2].id, floorNumber: 1, description: "Ground Floor" },
        { buildingId: buildings[2].id, floorNumber: 2, description: "First Floor" },
        { buildingId: buildings[2].id, floorNumber: 3, description: "Second Floor" },
      ])
      .returning();

    console.log(`✅ Inserted ${floors.length} floors\n`);

    // 5. Insert Rooms
    console.log("🚪 Inserting rooms...");
    const rooms = await db
      .insert(roomsTable)
      .values([
        { buildingId: buildings[0].id, floorId: floors[0].id, roomNumber: "A-101", roomType: "SINGLE", capacity: 1, gender: "MALE", status: "AVAILABLE" },
        { buildingId: buildings[0].id, floorId: floors[1].id, roomNumber: "A-201", roomType: "DOUBLE", capacity: 2, gender: "MALE", status: "OCCUPIED" },
        { buildingId: buildings[0].id, floorId: floors[1].id, roomNumber: "A-202", roomType: "DOUBLE", capacity: 2, gender: "FEMALE", status: "OCCUPIED" },
        { buildingId: buildings[0].id, floorId: floors[2].id, roomNumber: "A-301", roomType: "TRIPLE", capacity: 3, gender: "MALE", status: "AVAILABLE" },
        { buildingId: buildings[0].id, floorId: floors[2].id, roomNumber: "A-302", roomType: "DOUBLE", capacity: 2, gender: "MALE", status: "OCCUPIED" },
        { buildingId: buildings[0].id, floorId: floors[3].id, roomNumber: "A-401", roomType: "SINGLE", capacity: 1, gender: "FEMALE", status: "AVAILABLE" },
        { buildingId: buildings[0].id, floorId: floors[3].id, roomNumber: "A-402", roomType: "DOUBLE", capacity: 2, gender: "FEMALE", status: "OCCUPIED" },
        { buildingId: buildings[0].id, floorId: floors[4].id, roomNumber: "A-501", roomType: "STUDIO", capacity: 1, gender: "MALE", status: "MAINTENANCE" },
        { buildingId: buildings[1].id, floorId: floors[6].id, roomNumber: "B-201", roomType: "DOUBLE", capacity: 2, gender: "MALE", status: "OCCUPIED" },
        { buildingId: buildings[1].id, floorId: floors[7].id, roomNumber: "B-301", roomType: "TRIPLE", capacity: 3, gender: "FEMALE", status: "AVAILABLE" },
        { buildingId: buildings[2].id, floorId: floors[11].id, roomNumber: "C-201", roomType: "DOUBLE", capacity: 2, gender: "MIXED", status: "OCCUPIED" },
        { buildingId: buildings[2].id, floorId: floors[11].id, roomNumber: "C-301", roomType: "SINGLE", capacity: 1, gender: "MALE", status: "AVAILABLE" },
      ])
      .returning();

    console.log(`✅ Inserted ${rooms.length} rooms\n`);

    // 6. Insert Room Assignments
    console.log("🏠 Inserting room assignments...");
    const assignments = await db
      .insert(assignmentsTable)
      .values([
        { employeeId: employees[0].id, roomId: rooms[1].id, bedNumber: 1, checkInDate: new Date("2024-01-15"), expectedCheckOutDate: new Date("2025-12-31"), status: "ACTIVE" },
        { employeeId: employees[1].id, roomId: rooms[2].id, bedNumber: 1, checkInDate: new Date("2024-02-01"), expectedCheckOutDate: new Date("2025-12-31"), status: "ACTIVE" },
        { employeeId: employees[4].id, roomId: rooms[4].id, bedNumber: 1, checkInDate: new Date("2024-03-10"), expectedCheckOutDate: new Date("2025-12-31"), status: "ACTIVE" },
        { employeeId: employees[2].id, roomId: rooms[6].id, bedNumber: 2, checkInDate: new Date("2024-01-20"), expectedCheckOutDate: new Date("2025-12-31"), status: "ACTIVE" },
        { employeeId: employees[5].id, roomId: rooms[8].id, bedNumber: 1, checkInDate: new Date("2024-04-05"), expectedCheckOutDate: new Date("2025-12-31"), status: "ACTIVE" },
        { employeeId: employees[6].id, roomId: rooms[10].id, bedNumber: 1, checkInDate: new Date("2024-05-12"), expectedCheckOutDate: new Date("2025-12-31"), status: "ACTIVE" },
      ])
      .returning();

    console.log(`✅ Inserted ${assignments.length} room assignments\n`);

    console.log("✨ Test data insertion completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`   - Employees: ${employees.length}`);
    console.log(`   - Portal Accounts: ${accounts.length}`);
    console.log(`   - Buildings: ${buildings.length}`);
    console.log(`   - Floors: ${floors.length}`);
    console.log(`   - Rooms: ${rooms.length}`);
    console.log(`   - Assignments: ${assignments.length}`);
    console.log(`\n🔑 Login with any employee ID (EMP001-EMP007) and password: "${DEFAULT_PASSWORD}"`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error inserting test data:", error);
    process.exit(1);
  }
}

insertTestData();
