import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const DEPOT_API_URL = "http://4.224.186.213/evaluation-service/depots";
const VEHICLES_API_URL = "http://4.224.186.213/evaluation-service/vehicles";

function buildAuthHeaders(req) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  } else if (req.headers["x-api-key"]) {
    headers.Authorization = `Bearer ${req.headers["x-api-key"]}`;
  }

  return headers;
}

async function fetchJson(url, req) {
  const response = await fetch(url, {
    headers: buildAuthHeaders(req),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText} - ${message}`);
  }

  return response.json();
}

function getBestSchedule(vehicles, budget) {
  const maxBudget = Number.isInteger(budget) && budget >= 0 ? budget : 0;
  const dp = Array.from({ length: maxBudget + 1 }, () => ({ value: 0, items: [] }));

  for (const vehicle of vehicles) {
    const weight = Number(vehicle.Duration ?? 0);
    const value = Number(vehicle.Impact ?? 0);

    if (!Number.isFinite(weight) || !Number.isFinite(value) || weight <= 0) {
      continue;
    }

    for (let capacity = maxBudget; capacity >= weight; capacity -= 1) {
      const previous = dp[capacity - weight];
      const candidateValue = previous.value + value;

      if (candidateValue > dp[capacity].value) {
        dp[capacity] = {
          value: candidateValue,
          items: [...previous.items, vehicle],
        };
      }
    }
  }

  const best = dp[maxBudget];
  const duration = best.items.reduce((sum, item) => sum + Number(item.Duration), 0);

  return {
    totalImpact: best.value,
    totalDuration: duration,
    vehicles: best.items,
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "Vehicle Maintenance Scheduler Microservice",
    endpoints: [
      { path: "/schedule", description: "Compute the best schedule for every depot" },
      { path: "/schedule/:depotId", description: "Compute the best schedule for one depot" },
      { path: "/depots", description: "Proxy to depot list from evaluation service" },
      { path: "/vehicles", description: "Proxy to vehicle list from evaluation service" },
    ],
    note: "Pass Authorization header or x-api-key to access protected provider APIs.",
  });
});

app.get("/depots", async (req, res) => {
  try {
    const data = await fetchJson(DEPOT_API_URL, req);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/vehicles", async (req, res) => {
  try {
    const data = await fetchJson(VEHICLES_API_URL, req);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/schedule", async (req, res) => {
  try {
    const depotsData = await fetchJson(DEPOT_API_URL, req);
    const vehiclesData = await fetchJson(VEHICLES_API_URL, req);

    const depots = Array.isArray(depotsData.depots) ? depotsData.depots : [];
    const vehicles = Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : [];

    const schedules = depots.map((depot) => ({
      depotId: depot.ID,
      mechanicHours: Number(depot.MechanicHours ?? 0),
      schedule: getBestSchedule(vehicles, Number(depot.MechanicHours ?? 0)),
    }));

    res.json({ schedules });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/schedule/:depotId", async (req, res) => {
  try {
    const depotId = Number(req.params.depotId);
    const depotsData = await fetchJson(DEPOT_API_URL, req);
    const vehiclesData = await fetchJson(VEHICLES_API_URL, req);

    const depots = Array.isArray(depotsData.depots) ? depotsData.depots : [];
    const depot = depots.find((item) => Number(item.ID) === depotId);

    if (!depot) {
      return res.status(404).json({ error: `Depot ${req.params.depotId} not found` });
    }

    const vehicles = Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : [];
    const budgetOverride = req.query.budget ? Number(req.query.budget) : undefined;
    const budget = Number.isFinite(budgetOverride) && budgetOverride >= 0 ? budgetOverride : Number(depot.MechanicHours ?? 0);

    const schedule = getBestSchedule(vehicles, budget);

    res.json({
      depotId: depot.ID,
      mechanicHours: budget,
      schedule,
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Vehicle Maintenance Scheduler listening on port ${PORT}`);
});
