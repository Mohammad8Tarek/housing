async function seed() {
  console.log("Seeding is disabled for the multi-tenant architecture. Please use the application UI to manage properties and data.");
}

seed().catch(console.error).finally(() => process.exit(0));

