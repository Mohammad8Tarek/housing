async function run() {
  const url = "https://sunrise-api-production-b3f9.up.railway.app/api/portal-auth/ping";
  console.log("Waiting for deployment...");
  while (true) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.includes("pong_deployed")) {
        console.log("Deployment SUCCESS!");
        break;
      }
      console.log("Still waiting... Status:", res.status, text.substring(0, 50));
    } catch (e) {
      console.log("Error:", e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}
run();
