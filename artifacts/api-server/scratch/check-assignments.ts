import { pool } from "@workspace/db";
pool
  .query("SELECT status, count(*) FROM assignments GROUP BY status")
  .then((res) => console.log(res.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
