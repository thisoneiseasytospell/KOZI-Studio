(() => {
  "use strict";

  const endpoint = "/api/presence";
  const maximumReportSeconds = 30;
  const maximumSampleGapMilliseconds = 45000;
  const trigger = document.querySelector("[data-collective-trigger]");
  const receipt = document.querySelector("[data-collective-receipt]");
  const timeValue = document.querySelector("[data-collective-time]");
  const countriesValue = document.querySelector("[data-collective-countries]");

  let serverTotalSeconds = null;
  let countriesReached = null;
  let pendingVisibleMilliseconds = 0;
  let inFlightSeconds = 0;
  let requestInFlight = null;
  let countingVisibleTime = !document.hidden;
  let lastSampleTime = performance.now();
  let nextReportTime = 0;
  let hasLoggedAvailabilityError = false;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDuration(value) {
    const totalSeconds = Math.max(0, Math.floor(value));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
    }

    if (hours > 0) {
      return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${pad(seconds)}s`;
    }

    return `${seconds}s`;
  }

  function renderMetrics() {
    if (timeValue) {
      if (Number.isFinite(serverTotalSeconds)) {
        const localUnconfirmedSeconds =
          inFlightSeconds + Math.floor(pendingVisibleMilliseconds / 1000);

        timeValue.textContent = formatDuration(
          serverTotalSeconds + localUnconfirmedSeconds
        );
      } else {
        timeValue.textContent = "\u2014";
      }
    }

    if (countriesValue) {
      countriesValue.textContent = Number.isFinite(countriesReached)
        ? String(countriesReached)
        : "\u2014";
    }
  }

  function applyMetrics(data) {
    const nextTotal = Number(data?.totalSeconds);
    const nextCountries = Number(data?.countriesReached);

    if (Number.isFinite(nextTotal) && nextTotal >= 0) {
      serverTotalSeconds = Number.isFinite(serverTotalSeconds)
        ? Math.max(serverTotalSeconds, nextTotal)
        : nextTotal;
    }

    if (Number.isFinite(nextCountries) && nextCountries >= 0) {
      countriesReached = Number.isFinite(countriesReached)
        ? Math.max(countriesReached, nextCountries)
        : nextCountries;
    }

    renderMetrics();
  }

  function sampleVisibleTime(now = performance.now()) {
    const elapsed = Math.max(0, now - lastSampleTime);

    if (countingVisibleTime) {
      pendingVisibleMilliseconds += Math.min(
        elapsed,
        maximumSampleGapMilliseconds
      );
    }

    lastSampleTime = now;
  }

  function secondsAvailableToReport() {
    return Math.min(
      maximumReportSeconds,
      Math.floor(pendingVisibleMilliseconds / 1000)
    );
  }

  function report(seconds, { keepalive = false } = {}) {
    if (requestInFlight) {
      return requestInFlight;
    }

    const reportedSeconds = Math.max(
      0,
      Math.min(maximumReportSeconds, Math.floor(seconds))
    );

    if (reportedSeconds > 0) {
      pendingVisibleMilliseconds -= reportedSeconds * 1000;
      inFlightSeconds = reportedSeconds;
      renderMetrics();
    }

    requestInFlight = (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ seconds: reportedSeconds }),
          cache: "no-store",
          credentials: "same-origin",
          keepalive,
        });

        if (!response.ok) {
          throw new Error(`Collective presence request failed: ${response.status}`);
        }

        const data = await response.json();
        inFlightSeconds = 0;
        nextReportTime = 0;
        applyMetrics(data);
      } catch (error) {
        if (reportedSeconds > 0) {
          pendingVisibleMilliseconds += reportedSeconds * 1000;
        }

        inFlightSeconds = 0;
        nextReportTime = performance.now() + 60000;
        renderMetrics();

        if (!hasLoggedAvailabilityError) {
          hasLoggedAvailabilityError = true;
          console.info("Collective totals are temporarily unavailable.", error);
        }
      } finally {
        requestInFlight = null;
      }
    })();

    return requestInFlight;
  }

  function reportPendingTime({ force = false, keepalive = false } = {}) {
    sampleVisibleTime();
    const seconds = secondsAvailableToReport();

    if (performance.now() < nextReportTime) {
      return requestInFlight;
    }

    if (!force && seconds < maximumReportSeconds) {
      return requestInFlight;
    }

    return report(seconds, { keepalive });
  }

  function beaconPendingTime() {
    sampleVisibleTime();
    const seconds = secondsAvailableToReport();

    if (seconds <= 0 || typeof navigator.sendBeacon !== "function") {
      return;
    }

    pendingVisibleMilliseconds -= seconds * 1000;
    const body = new Blob([JSON.stringify({ seconds })], {
      type: "application/json",
    });

    if (!navigator.sendBeacon(endpoint, body)) {
      pendingVisibleMilliseconds += seconds * 1000;
    }
  }

  function setReceiptOpen(open) {
    if (!trigger || !receipt) {
      return;
    }

    trigger.setAttribute("aria-expanded", String(open));
    receipt.setAttribute("aria-hidden", String(!open));
    receipt.inert = !open;
    receipt.classList.toggle("is-visible", open);

    if (open) {
      reportPendingTime({ force: true });
    }
  }

  if (trigger && receipt) {
    trigger.addEventListener("click", () => {
      setReceiptOpen(trigger.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setReceiptOpen(false);
      }
    });

    const intro = trigger.closest(".site-intro");

    if (intro && "MutationObserver" in window) {
      const introObserver = new MutationObserver(() => {
        if (!intro.classList.contains("is-expanded")) {
          setReceiptOpen(false);
        }
      });

      introObserver.observe(intro, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  document.addEventListener("visibilitychange", () => {
    sampleVisibleTime();
    countingVisibleTime = !document.hidden;
    lastSampleTime = performance.now();

    if (document.hidden) {
      reportPendingTime({ force: true, keepalive: true });
    } else {
      reportPendingTime({ force: true });
    }
  });

  window.addEventListener("pagehide", () => {
    sampleVisibleTime();
    countingVisibleTime = false;
    beaconPendingTime();
  });

  window.addEventListener("pageshow", () => {
    countingVisibleTime = !document.hidden;
    lastSampleTime = performance.now();
  });

  window.setInterval(() => {
    sampleVisibleTime();
    renderMetrics();
    reportPendingTime();
  }, 1000);

  renderMetrics();
  report(0);
})();
