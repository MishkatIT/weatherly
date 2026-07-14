import fs from "fs";

// Load env variables manually from .env.local
const envLocal = fs.readFileSync(".env.local", "utf8");
const env = {};
envLocal.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join("=").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

async function callWeatherGeo(params = {}) {
  const url = new URL("https://api.weather-ai.co/v1/weather-geo");
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${env.WAI_API_KEY}`
    }
  });
  return res.json();
}

async function main() {
  console.log("--- 1. Querying with IP 127.0.0.1 ---");
  const res1 = await callWeatherGeo({ ip: "127.0.0.1" });
  console.log("Location 127.0.0.1:", res1.location || res1);

  console.log("\n--- 2. Querying without IP parameter ---");
  const res2 = await callWeatherGeo({});
  console.log("Location auto-detected:", res2.location || res2);

  console.log("\n--- 3. Querying with a known public IP (8.8.8.8) ---");
  const res3 = await callWeatherGeo({ ip: "8.8.8.8" });
  console.log("Location 8.8.8.8:", res3.location || res3);
}

main();
