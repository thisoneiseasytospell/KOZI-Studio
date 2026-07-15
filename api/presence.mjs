const maximumReportSeconds = 30;

function responseJson(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function storageConfiguration() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function keyPrefix() {
  if (process.env.KOZI_COLLECTIVE_NAMESPACE) {
    return `kozi:collective:${process.env.KOZI_COLLECTIVE_NAMESPACE}`;
  }

  return process.env.VERCEL_ENV === "production"
    ? "kozi:collective:production"
    : "kozi:collective:preview";
}

function countryFromRequest(request) {
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();

  if (!country || country === "XX" || !/^[A-Z]{2}$/.test(country)) {
    return null;
  }

  return country;
}

async function secondsFromRequest(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > 512) {
    throw new RangeError("Request body is too large.");
  }

  const text = await request.text();
  const data = text ? JSON.parse(text) : {};
  const seconds = Number(data.seconds ?? 0);

  if (
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > maximumReportSeconds
  ) {
    throw new RangeError("Reported time is outside the accepted range.");
  }

  return seconds;
}

async function runPipeline(configuration, commands) {
  const response = await fetch(`${configuration.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Presence storage returned ${response.status}.`);
  }

  const results = await response.json();

  if (
    !Array.isArray(results) ||
    results.length !== commands.length ||
    results.some((result) => result?.error)
  ) {
    throw new Error("Presence storage returned an invalid response.");
  }

  return results;
}

function numericResult(result) {
  const value = Number(result?.result ?? 0);

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function readMetrics(configuration, prefix) {
  const results = await runPipeline(configuration, [
    ["GET", `${prefix}:time-seconds`],
    ["SCARD", `${prefix}:countries`],
  ]);

  return {
    totalSeconds: numericResult(results[0]),
    countriesReached: numericResult(results[1]),
  };
}

async function updateMetrics(configuration, prefix, seconds, country) {
  const commands = [["INCRBY", `${prefix}:time-seconds`, seconds]];

  if (country) {
    commands.push(["SADD", `${prefix}:countries`, country]);
  }

  commands.push(["SCARD", `${prefix}:countries`]);
  const results = await runPipeline(configuration, commands);

  return {
    totalSeconds: numericResult(results[0]),
    countriesReached: numericResult(results[results.length - 1]),
  };
}

export default {
  async fetch(request) {
    if (!["GET", "POST"].includes(request.method)) {
      return responseJson({ error: "Method not allowed." }, 405);
    }

    const fetchSite = request.headers.get("sec-fetch-site");

    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      return responseJson({ error: "Cross-site requests are not accepted." }, 403);
    }

    const configuration = storageConfiguration();

    if (!configuration) {
      return responseJson({ error: "Collective storage is not configured." }, 503);
    }

    const prefix = keyPrefix();

    try {
      const metrics = request.method === "GET"
        ? await readMetrics(configuration, prefix)
        : await updateMetrics(
            configuration,
            prefix,
            await secondsFromRequest(request),
            countryFromRequest(request)
          );

      return responseJson(metrics);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof RangeError) {
        return responseJson({ error: "Invalid presence report." }, 400);
      }

      console.error("Unable to update collective presence totals.", error);
      return responseJson({ error: "Collective totals are temporarily unavailable." }, 503);
    }
  },
};
