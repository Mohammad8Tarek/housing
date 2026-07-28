async function run() {
  const url =
    "https://sunrise-api-production-b3f9.up.railway.app/api/portal-auth/login";
  const body = JSON.stringify({ employeeId: "10575", password: "1234" });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://housing-employee-portal.vercel.app",
      },
      body,
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
