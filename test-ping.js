async function run() {
  const url = "https://sunrise-api-production-b3f9.up.railway.app/api/portal-auth/ping";
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
