async function run() {
  const url =
    "https://sunrise-api-production-b3f9.up.railway.app/api/auth/login";
  const body = JSON.stringify({ username: "admin", password: "wrongpassword" });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
