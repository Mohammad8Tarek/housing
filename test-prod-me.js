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
    console.log("Login Status:", res.status);
    console.log("Login Response:", text);

    const cookies = res.headers.get("set-cookie");
    console.log("Set-Cookie:", cookies);

    const meUrl =
      "https://sunrise-api-production-b3f9.up.railway.app/api/portal-auth/me";
    const res2 = await fetch(meUrl, {
      headers: {
        Cookie: cookies || "",
        Origin: "https://housing-employee-portal.vercel.app",
      },
    });

    console.log("Me Status:", res2.status);
    console.log("Me Response:", await res2.text());
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
