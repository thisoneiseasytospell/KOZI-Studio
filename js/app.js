document.documentElement.classList.add("js");

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = reduceMotionQuery.matches;

reduceMotionQuery.addEventListener?.("change", () => {
  reduceMotion = reduceMotionQuery.matches;
});

const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const deviceDarkTheme = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "kozi-theme-inverted";
let themeInverted = (() => {
  try {
    return window.sessionStorage.getItem(themeStorageKey) === "true";
  } catch {
    return false;
  }
})();
let themeTransitionFrame = 0;

function updateThemeInversion() {
  window.cancelAnimationFrame(themeTransitionFrame);
  document.documentElement.classList.add("theme-switching");
  const effectiveDarkTheme = deviceDarkTheme.matches !== themeInverted;
  document.documentElement.classList.toggle("theme-inverted", themeInverted);
  document.documentElement.style.colorScheme = effectiveDarkTheme ? "dark" : "light";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = effectiveDarkTheme ? "#0c0c0b" : "#f1f0eb";
    });
  themeTransitionFrame = window.requestAnimationFrame(() => {
    themeTransitionFrame = window.requestAnimationFrame(() => {
      document.documentElement.classList.remove("theme-switching");
    });
  });
}

function toggleThemeInversion() {
  themeInverted = !themeInverted;

  try {
    window.sessionStorage.setItem(themeStorageKey, String(themeInverted));
  } catch {
    // Storage can be unavailable in private browsing; the toggle still works.
  }

  updateThemeInversion();
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const isEditable =
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

  if (
    isEditable ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.key.toLocaleLowerCase() !== "i"
  ) {
    return;
  }

  event.preventDefault();
  toggleThemeInversion();
});

deviceDarkTheme.addEventListener?.("change", updateThemeInversion);
updateThemeInversion();

function setupPresenceFavicon() {
  const favicons = Array.from(document.querySelectorAll("[data-presence-favicon]"));

  if (favicons.length === 0) {
    return;
  }

  function updateFavicon() {
    const isInactive = document.hidden || !document.hasFocus();

    favicons.forEach((favicon) => {
      favicon.href = isInactive
        ? favicon.dataset.inactiveHref
        : favicon.dataset.activeHref;
    });
  }

  document.addEventListener("visibilitychange", updateFavicon);
  window.addEventListener("focus", updateFavicon);
  window.addEventListener("blur", updateFavicon);
  updateFavicon();
}

setupPresenceFavicon();

function setupRtmClock() {
  const clock = document.querySelector("[data-rtm-clock]");
  const time = clock?.querySelector("[data-rtm-time]");
  const hour = clock?.querySelector("[data-rtm-hour]");
  const minute = clock?.querySelector("[data-rtm-minute]");

  if (!clock || !time || !hour || !minute) {
    return;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let clockTimer = 0;

  function updateClock() {
    const now = new Date();
    const parts = Object.fromEntries(
      formatter
        .formatToParts(now)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );
    const displayMinute = parts.minute;

    hour.textContent = parts.hour;
    minute.textContent = displayMinute;
    time.dateTime = now.toISOString();
    clock.setAttribute(
      "aria-label",
      `Rotterdam time ${parts.hour}:${displayMinute}`
    );

    window.clearTimeout(clockTimer);
    clockTimer = window.setTimeout(
      updateClock,
      60000 - (now.getSeconds() * 1000 + now.getMilliseconds())
    );
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateClock();
    }
  });
  updateClock();
}

setupRtmClock();

function setupIntroDisclosure() {
  const intro = document.querySelector(".site-intro");
  const shell = document.querySelector("[data-intro-shell]");
  const trigger = document.querySelector(".intro-trigger");
  const headline = document.querySelector(".intro-headline");
  const details = document.querySelector(".intro-details-wrap");
  const followLabel = document.querySelector("[data-intro-follow]");
  const collapseButton = document.querySelector("[data-intro-collapse]");

  if (
    !intro ||
    !shell ||
    !trigger ||
    !headline ||
    !details ||
    !followLabel ||
    !collapseButton
  ) {
    return;
  }

  const revealItems = Array.from(details.querySelectorAll(".detail-reveal"));
  let isExpanded = false;
  let hasFollowPosition = false;
  let followTarget = { x: 0, y: 0 };
  let followPosition = { ...followTarget };

  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-index", String(index));
    item.style.setProperty("--reveal-reverse", String(revealItems.length - index - 1));
  });

  function updateIntro() {
    trigger.setAttribute("aria-expanded", String(isExpanded));
    details.setAttribute("aria-hidden", String(!isExpanded));
    details.inert = !isExpanded;
    followLabel.textContent = "Read more";
    intro.classList.toggle("is-expanded", isExpanded);
  }

  function updateFollowTarget(event) {
    if (!hoverCapable.matches) {
      return;
    }

    const bounds = trigger.getBoundingClientRect();
    const headlineBounds = headline.getBoundingClientRect();
    const labelWidth = followLabel.offsetWidth;
    const pointerOffsetX = event.clientX - (headlineBounds.left + headlineBounds.width / 2);
    const pointerOffsetY = event.clientY - (headlineBounds.top + headlineBounds.height / 2);
    const baseX = (headlineBounds.width - labelWidth) / 2;
    const maximumX = Math.max(0, bounds.width - labelWidth);
    const x = Math.max(0, Math.min(maximumX, baseX + pointerOffsetX * 0.18));
    const minimumY = headline.offsetHeight + 6;
    const y = Math.max(minimumY, headline.offsetHeight + 9 + pointerOffsetY * 0.08);

    followTarget = { x, y };

    if (!hasFollowPosition) {
      followPosition = { ...followTarget };
      hasFollowPosition = true;
    }
  }

  let followAnimationFrame = 0;

  trigger.addEventListener("pointerenter", (event) => {
    updateFollowTarget(event);
    trigger.classList.toggle("is-following", hoverCapable.matches);
    startFollowAnimation();
  });

  trigger.addEventListener("pointermove", (event) => {
    updateFollowTarget(event);
    startFollowAnimation();
  });

  trigger.addEventListener("pointerleave", () => {
    trigger.classList.remove("is-following");
  });

  function animateFollowLabel() {
    const easing = reduceMotion ? 1 : 0.14;

    followPosition.x += (followTarget.x - followPosition.x) * easing;
    followPosition.y += (followTarget.y - followPosition.y) * easing;
    followLabel.style.transform = `translate3d(${followPosition.x}px, ${followPosition.y}px, 0)`;

    const settled =
      Math.abs(followTarget.x - followPosition.x) < 0.1 &&
      Math.abs(followTarget.y - followPosition.y) < 0.1;

    if (settled && !trigger.classList.contains("is-following")) {
      followAnimationFrame = 0;
      return;
    }

    followAnimationFrame = requestAnimationFrame(animateFollowLabel);
  }

  function startFollowAnimation() {
    if (!followAnimationFrame && hoverCapable.matches) {
      followAnimationFrame = requestAnimationFrame(animateFollowLabel);
    }
  }

  trigger.addEventListener("click", (event) => {
    isExpanded = !isExpanded;
    updateIntro();

    if (event.detail > 0) {
      trigger.blur();
    }
  });

  collapseButton.addEventListener("click", (event) => {
    isExpanded = false;
    updateIntro();

    if (event.detail === 0) {
      trigger.focus();
    }
  });

  shell.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    isExpanded = false;
    trigger.focus();
    updateIntro();
  });

  updateIntro();
}

setupIntroDisclosure();

const stage = document.querySelector(".work-stage");
const frame = document.querySelector("[data-video-frame]");
const videos = stage ? Array.from(stage.querySelectorAll(".work-video")) : [];
const projectLabel = document.querySelector("[data-project-label]");
const projectNumber = document.querySelector("[data-project-number]");
const projectTitle = document.querySelector("[data-project-title]");
const motionButton = document.querySelector(".motion-permission");
const stageStatus = document.querySelector("[data-stage-status]");
const projectSidebar = document.querySelector("[data-project-sidebar]");
const projectSidebarList = document.querySelector("[data-project-sidebar-list]");
const projectSidebarToggle = document.querySelector("[data-project-sidebar-toggle]");
const projectSidebarToggleLabel = document.querySelector("[data-project-sidebar-toggle-label]");
const projectSidebarToggleNumber = document.querySelector("[data-project-sidebar-toggle-number]");
const projectSidebarClose = document.querySelector("[data-project-sidebar-close]");
const projectSidebarBackdrop = document.querySelector("[data-project-sidebar-backdrop]");

if (stage && frame && videos.length === 2 && projectLabel && projectNumber && projectTitle) {
  setupWorkStage().catch((error) => {
    console.error(error);
    stage.classList.remove("is-loading");
    stage.setAttribute("aria-busy", "false");
    stageStatus.textContent = "Selected work is unavailable.";
  });
}

async function setupWorkStage() {
  const response = await fetch("./assets/projects/index.json?v=7");

  if (!response.ok) {
    throw new Error(`Unable to load video manifest: ${response.status}`);
  }

  const projectIndex = await response.json();
  const manifest = Array.isArray(projectIndex) ? projectIndex : projectIndex.projects;

  if (!Array.isArray(manifest)) {
    throw new Error("The project index has an invalid format.");
  }

  const compactVideo = window.matchMedia("(max-width: 760px), (hover: none), (pointer: coarse)");
  const normalizeVideoPath = (path) => {
    if (!path) {
      return "";
    }

    return path.startsWith(".") || path.startsWith("/") ? path : `./${path}`;
  };
  const projects = manifest
    .filter((project) => (project.desktopPath || project.mobilePath || project.localPath) && project.title)
    .map((project, index) => ({
      index,
      order: Number(project.order) || index + 1,
      slug: project.slug,
      caseStudySlug: project.caseStudySlug || project.slug,
      title: project.title,
      alt: project.alt || `${project.title} project preview`,
      detailPath: project.detailPath,
      route: project.route || `/work/${project.slug}/`,
      desktopSrc: normalizeVideoPath(project.desktopPath || project.localPath || project.mobilePath),
      mobileSrc: normalizeVideoPath(project.mobilePath || project.desktopPath || project.localPath),
    }));

  if (projects.length === 0) {
    throw new Error("The video manifest does not contain any projects.");
  }

  const ascendingProjectIndices = projects
    .map((project) => project.index)
    .sort((firstIndex, secondIndex) => {
      return projects[firstIndex].order - projects[secondIndex].order;
    });
  let activeSlotIndex = 0;
  let currentProjectIndex = -1;
  let queuedProjectIndex = -1;
  let queuedReady = false;
  let queuedLoading = false;
  let initialQueueStarted = false;
  let switchRequest = null;
  let stageVisible = false;
  let loadTokens = [0, 0];
  let pointerPosition = null;
  let pointerActive = false;
  let lastPointerInput = 0;
  let pointerReentryTime = 0;
  let touchPosition = null;
  let touchStartPosition = null;
  let touchDragging = false;
  let touchTravel = 0;
  let suppressClick = false;
  let motionListening = false;
  let shakeListening = false;
  let shakeWindowStart = 0;
  let lastShakePeak = 0;
  let lastShakeToggle = 0;
  let shakePeakCount = 0;
  let baseOrientation = null;
  let motionOrigin = null;
  let lastTiltPosition = null;
  let lastMotionInput = 0;
  let lastDirectionalSwitch = -Infinity;
  let directionTracking = {
    source: null,
    active: null,
    candidate: null,
    candidateTravel: 0,
    candidateSamples: 0,
    lastSampleTime: 0,
  };
  let motionEdges = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  };
  let lastUserActivity = performance.now();
  let caseStudyActive = false;
  let stageVideoBorrowed = false;
  let sidebarOpen = false;
  let sidebarRestoreFocus = null;
  let sidebarBackdropTimer = 0;
  let pendingSidebarProject = null;
  let sidebarPointerActive = false;
  let trailCursor = 0;
  let lastTrailTime = 0;
  let lastTrailPosition = null;
  let idlePosition = null;
  let idleLastTime = performance.now();
  const idleSpeed = coarsePointer.matches ? 39 : 53;
  // On mobile, begin the idle float sideways/downward so the first visible
  // movement never looks like the video is immediately escaping upward.
  // Subsequent steering and edge bounces still let it roam in every direction.
  const idleStartAngle = coarsePointer.matches
    ? Math.PI * (1 / 12 + Math.random() * 5 / 6)
    : Math.random() * Math.PI * 2;
  let idleVelocity = {
    x: Math.cos(idleStartAngle) * idleSpeed,
    y: Math.sin(idleStartAngle) * idleSpeed,
  };
  let idleTurnRate = 0;
  let idleTargetTurnRate = 0;
  let idleNextSteerTime = idleLastTime;
  const trailPoolSize = coarsePointer.matches ? 128 : 312;
  const trailPoolReserve = coarsePointer.matches ? 12 : 16;
  const idleTrailMinimumDuration = 5200;
  const idleTrailMaximumDuration = 45000;
  const idleTrailRampDuration = 12000;

  const compactSidebar = window.matchMedia(
    "(max-width: 760px), (hover: none), (pointer: coarse)"
  );
  let sidebarHoverHue = Math.random() * 360;
  let sidebarHoverTimer = 0;

  function sidebarHslToRgb(hue, saturation, lightness) {
    const normalizedSaturation = saturation / 100;
    const normalizedLightness = lightness / 100;
    const chroma =
      (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
    const segment = hue / 60;
    const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
    let red = 0;
    let green = 0;
    let blue = 0;

    if (segment < 1) {
      red = chroma;
      green = secondary;
    } else if (segment < 2) {
      red = secondary;
      green = chroma;
    } else if (segment < 3) {
      green = chroma;
      blue = secondary;
    } else if (segment < 4) {
      green = secondary;
      blue = chroma;
    } else if (segment < 5) {
      red = secondary;
      blue = chroma;
    } else {
      red = chroma;
      blue = secondary;
    }

    const offset = normalizedLightness - chroma / 2;
    return [red + offset, green + offset, blue + offset];
  }

  function sidebarHoverTextColor(hue, saturation, lightness) {
    const luminance = sidebarHslToRgb(hue, saturation, lightness)
      .map((channel) => (
        channel <= 0.04045
          ? channel / 12.92
          : Math.pow((channel + 0.055) / 1.055, 2.4)
      ))
      .reduce(
        (total, channel, index) =>
          total + channel * [0.2126, 0.7152, 0.0722][index],
        0
      );
    const darkContrast = (luminance + 0.05) / 0.05;
    const lightContrast = 1.05 / (luminance + 0.05);
    return darkContrast >= lightContrast ? "#050505" : "#ffffff";
  }

  function setSidebarHoverColor(link) {
    sidebarHoverHue = (sidebarHoverHue + 137.508 + (Math.random() - 0.5) * 18) % 360;
    const previousHue = Number(link.dataset.sidebarHoverHue);

    if (Number.isFinite(previousHue)) {
      const distance = Math.abs(((sidebarHoverHue - previousHue + 540) % 360) - 180);

      if (distance < 54) {
        sidebarHoverHue = (sidebarHoverHue + 96) % 360;
      }
    }

    const saturation = 78 + Math.random() * 12;
    const lightness = 54 + Math.random() * 14;
    link.dataset.sidebarHoverHue = sidebarHoverHue.toFixed(1);
    link.style.setProperty(
      "--sidebar-hover-color",
      `hsl(${sidebarHoverHue.toFixed(1)}deg ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`
    );
    link.style.setProperty(
      "--sidebar-hover-text",
      sidebarHoverTextColor(sidebarHoverHue, saturation, lightness)
    );
  }

  function cancelSidebarPreview() {
    window.clearTimeout(sidebarHoverTimer);
    sidebarHoverTimer = 0;
  }

  function scheduleSidebarPreview(projectIndex) {
    cancelSidebarPreview();

    if (!hoverCapable.matches || caseStudyActive || projectIndex === currentProjectIndex) {
      return;
    }

    sidebarHoverTimer = window.setTimeout(() => {
      sidebarHoverTimer = 0;

      if (caseStudyActive || projectIndex === currentProjectIndex) {
        return;
      }

      lastUserActivity = performance.now();
      switchVideo("ascending", projectIndex);
    }, 100);
  }

  function openSidebarCase(project, { skipTransition = false } = {}) {
    window.dispatchEvent(new CustomEvent("kozi:requestprojectopen", {
      detail: {
        slug: project.caseStudySlug,
        stageSlug: project.slug,
        project: { ...project },
        frame: skipTransition ? null : frame,
        video: skipTransition ? null : videos[activeSlotIndex],
        currentTime: skipTransition ? 0 : videos[activeSlotIndex].currentTime || 0,
        skipTransition,
      },
    }));
  }

  function updateSidebarMode() {
    if (!projectSidebar) {
      return;
    }

    if (!compactSidebar.matches) {
      sidebarOpen = false;
      projectSidebar.classList.remove("is-open");
      projectSidebar.removeAttribute("aria-hidden");
      projectSidebar.inert = false;
      projectSidebarToggle?.setAttribute("aria-expanded", "false");
      projectSidebarBackdrop?.classList.remove("is-visible");

      if (projectSidebarBackdrop) {
        projectSidebarBackdrop.hidden = true;
      }

      return;
    }

    projectSidebar.setAttribute("aria-hidden", String(!sidebarOpen));
    projectSidebar.inert = !sidebarOpen;
  }

  function setSidebarOpen(open, { restoreFocus = false } = {}) {
    if (!projectSidebar || !compactSidebar.matches) {
      return;
    }

    window.clearTimeout(sidebarBackdropTimer);
    sidebarOpen = open;
    projectSidebar.classList.toggle("is-open", open);
    projectSidebar.setAttribute("aria-hidden", String(!open));
    projectSidebar.inert = !open;
    projectSidebarToggle?.setAttribute("aria-expanded", String(open));

    if (projectSidebarToggleLabel) {
      projectSidebarToggleLabel.textContent = open ? "Close" : "Projects";
    }

    if (projectSidebarBackdrop) {
      if (open) {
        projectSidebarBackdrop.hidden = false;
        requestAnimationFrame(() => projectSidebarBackdrop.classList.add("is-visible"));
      } else {
        projectSidebarBackdrop.classList.remove("is-visible");
        sidebarBackdropTimer = window.setTimeout(() => {
          if (!sidebarOpen) {
            projectSidebarBackdrop.hidden = true;
          }
        }, reduceMotion ? 0 : 280);
      }
    }

    if (open) {
      sidebarRestoreFocus = document.activeElement;
      const currentLink = projectSidebar.querySelector(
        '[aria-current="page"], [data-preview-current="true"]'
      );
      requestAnimationFrame(() => (currentLink || projectSidebarClose)?.focus());
    } else if (restoreFocus && sidebarRestoreFocus?.isConnected) {
      sidebarRestoreFocus.focus({ preventScroll: true });
    }
  }

  function updateSidebarActive(project) {
    if (!projectSidebarList || !project) {
      return;
    }

    const links = Array.from(projectSidebarList.querySelectorAll("[data-sidebar-project]"));
    let currentLink = null;

    links.forEach((link) => {
      const current = link.dataset.sidebarProject === project.slug;
      link.classList.toggle("is-current", current);

      if (current) {
        link.dataset.previewCurrent = "true";
        currentLink = link;
      } else {
        delete link.dataset.previewCurrent;
      }
    });

    if (projectSidebarToggleNumber) {
      projectSidebarToggleNumber.textContent = String(project.order).padStart(2, "0");
    }

    currentLink?.scrollIntoView({ block: "nearest" });
  }

  function updateSidebarCaseActive(stageSlug = null, caseSlug = null) {
    if (!projectSidebarList) {
      return;
    }

    const links = Array.from(projectSidebarList.querySelectorAll("[data-sidebar-project]"));
    let hasExactMatch = false;

    links.forEach((link) => {
      const current = Boolean(stageSlug) && link.dataset.sidebarProject === stageSlug;
      link.classList.toggle("is-case-current", current);

      if (current) {
        hasExactMatch = true;
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (!hasExactMatch && caseSlug) {
      const canonicalLink = links.find(
        (link) => link.dataset.sidebarCase === caseSlug
      );
      canonicalLink?.classList.add("is-case-current");
      canonicalLink?.setAttribute("aria-current", "page");
    }
  }

  function buildProjectSidebar() {
    if (
      !projectSidebar ||
      !projectSidebarList ||
      !projectSidebarToggle ||
      !projectSidebarClose ||
      !projectSidebarBackdrop
    ) {
      return;
    }

    const fragment = document.createDocumentFragment();

    ascendingProjectIndices.forEach((projectIndex) => {
      const project = projects[projectIndex];

      if ([5, 12].includes(project.order)) {
        return;
      }

      const item = document.createElement("li");
      const link = document.createElement("button");
      const number = document.createElement("span");
      const title = document.createElement("span");
      item.className = "project-sidebar-item";
      link.className = "project-sidebar-link";
      link.type = "button";
      link.dataset.sidebarProject = project.slug;
      link.dataset.sidebarCase = project.caseStudySlug;
      link.setAttribute("aria-label", `${String(project.order).padStart(2, "0")} ${project.title}`);
      number.className = "project-sidebar-number";
      number.textContent = String(project.order).padStart(2, "0");
      title.className = "project-sidebar-title";
      title.textContent = project.title;
      link.append(number, title);
      setSidebarHoverColor(link);
      link.addEventListener("pointerenter", () => {
        setSidebarHoverColor(link);
        scheduleSidebarPreview(projectIndex);
      });
      link.addEventListener("pointerleave", cancelSidebarPreview);
      link.addEventListener("focus", () => {
        if (!link.matches(":hover")) {
          setSidebarHoverColor(link);
        }

        scheduleSidebarPreview(projectIndex);
      });
      link.addEventListener("blur", cancelSidebarPreview);
      item.append(link);
      fragment.append(item);
    });

    projectSidebarList.replaceChildren(fragment);

    projectSidebar.addEventListener("pointerenter", () => {
      sidebarPointerActive = true;
      resetDirectionTracking();
    });
    projectSidebar.addEventListener("pointerleave", () => {
      sidebarPointerActive = false;
      resetDirectionTracking();
      lastUserActivity = performance.now();
    });

    projectSidebarList.addEventListener("click", (event) => {
      const link = event.target.closest("[data-sidebar-project]");

      if (!link) {
        return;
      }

      const requestedIndex = projects.findIndex(
        (project) => project.slug === link.dataset.sidebarProject
      );
      const project = projects[requestedIndex];

      if (!project) {
        return;
      }

      event.preventDefault();
      cancelSidebarPreview();
      lastUserActivity = performance.now();

      if (caseStudyActive) {
        pendingSidebarProject = null;

        if (requestedIndex !== currentProjectIndex) {
          switchVideo("ascending", requestedIndex, true);
        }

        openSidebarCase(project, { skipTransition: true });
      } else if (requestedIndex === currentProjectIndex) {
        pendingSidebarProject = null;
        openSidebarCase(project);
      } else {
        pendingSidebarProject = project;
        switchVideo("ascending", requestedIndex, true);
      }

      if (compactSidebar.matches) {
        setSidebarOpen(false, { restoreFocus: true });
      }
    });

    projectSidebarToggle.addEventListener("click", () => {
      setSidebarOpen(!sidebarOpen, { restoreFocus: sidebarOpen });
    });
    projectSidebarClose.addEventListener("click", () => {
      setSidebarOpen(false, { restoreFocus: true });
    });
    projectSidebarBackdrop.addEventListener("click", () => {
      setSidebarOpen(false, { restoreFocus: true });
    });

    document.addEventListener("keydown", (event) => {
      if (!sidebarOpen || !compactSidebar.matches) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false, { restoreFocus: true });
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        projectSidebar.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      ).filter((element) => element.offsetParent !== null && !element.closest("[inert]"));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    compactSidebar.addEventListener?.("change", updateSidebarMode);
    window.addEventListener("kozi:caseprojectchange", (event) => {
      updateSidebarCaseActive(
        event.detail?.stageSlug || null,
        event.detail?.slug || null
      );
    });
    updateSidebarMode();
  }

  buildProjectSidebar();

  function videoSource(project) {
    return compactVideo.matches ? project.mobileSrc : project.desktopSrc;
  }

  let trailCanvases = [];

  function ensureTrailPool() {
    if (reduceMotion || trailCanvases.length > 0) {
      return;
    }

    trailCanvases = Array.from({ length: trailPoolSize }, () => {
      const canvas = document.createElement("canvas");
      canvas.className = "video-trail";
      canvas.setAttribute("aria-hidden", "true");
      stage.insertBefore(canvas, frame);
      return canvas;
    });
  }

  ensureTrailPool();
  reduceMotionQuery.addEventListener?.("change", () => {
    if (reduceMotion) {
      clearTrail();
    } else {
      ensureTrailPool();
    }
  });

  function hideLoading() {
    stage.classList.remove("is-loading");
    stage.setAttribute("aria-busy", "false");
  }

  const stageAnchor = () => {
    return {
      x: stage.clientWidth / 2,
      y: stage.clientHeight / 2,
    };
  };

  let targetPosition = stageAnchor();
  let currentPosition = { ...targetPosition };
  let previousFramePosition = { ...currentPosition };
  let previousFrameTime = performance.now();
  let frameVelocity = { ...idleVelocity };
  let frameSize = { width: 0, height: 0 };
  let labelHeight = 0;

  function markUserActivity() {
    lastUserActivity = performance.now();
  }

  window.addEventListener("pointerdown", (event) => {
    markUserActivity();

    if (event.pointerType !== "touch") {
      pointerPosition = { x: event.clientX, y: event.clientY };
      updateTargetFromPoint(event.clientX, event.clientY);
    }
  }, { passive: true });
  window.addEventListener("keydown", markUserActivity);

  function getMovementBounds(frameWidth = frameSize.width, frameHeight = frameSize.height) {
    const minX = frameWidth / 2;
    const minY = frameHeight / 2;

    return {
      minX,
      maxX: Math.max(minX, stage.clientWidth - frameWidth / 2),
      minY,
      maxY: Math.max(minY, stage.clientHeight - frameHeight / 2),
    };
  }

  function clampPosition(position, bounds = getMovementBounds()) {
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y)),
    };
  }

  function directionFromDelta(deltaX, deltaY) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX < 0 ? "left" : "right";
    }

    return deltaY < 0 ? "up" : "down";
  }

  function resetDirectionCandidate() {
    directionTracking.candidate = null;
    directionTracking.candidateTravel = 0;
    directionTracking.candidateSamples = 0;
  }

  function resetDirectionTracking(source = null) {
    directionTracking = {
      source,
      active: null,
      candidate: null,
      candidateTravel: 0,
      candidateSamples: 0,
      lastSampleTime: 0,
    };
  }

  function requestDirectionalVideo(source) {
    if (
      caseStudyActive ||
      sidebarPointerActive ||
      projectSidebar?.contains(document.activeElement)
    ) {
      return false;
    }

    const now = performance.now();
    const switchGap = source === "gyro"
      ? 320
      : source === "touch"
        ? 280
        : source === "pointer"
          ? 240
          : 720;

    if (now - lastDirectionalSwitch < switchGap) {
      return false;
    }

    lastDirectionalSwitch = now;
    switchVideo("ascending", null, source !== "idle");
    return true;
  }

  function trackMovementDirection(deltaX, deltaY, source) {
    const distance = Math.hypot(deltaX, deltaY);
    const minimumSample = source === "gyro" ? 0.12 : source === "touch" ? 0.8 : 1.2;

    if (distance < minimumSample) {
      return;
    }

    const now = performance.now();
    const nextDirection = directionFromDelta(deltaX, deltaY);

    if (directionTracking.source !== source) {
      resetDirectionTracking(source);
    }

    if (!directionTracking.active) {
      directionTracking.active = nextDirection;
      directionTracking.lastSampleTime = now;
      return;
    }

    if (nextDirection === directionTracking.active) {
      resetDirectionCandidate();
      directionTracking.lastSampleTime = now;
      return;
    }

    const candidateGap = source === "gyro" ? 180 : source === "pointer" ? 120 : 240;

    if (
      directionTracking.candidate !== nextDirection ||
      now - directionTracking.lastSampleTime > candidateGap
    ) {
      resetDirectionCandidate();
      directionTracking.candidate = nextDirection;
    }

    directionTracking.candidateTravel += distance;
    directionTracking.candidateSamples += 1;
    directionTracking.lastSampleTime = now;

    // A new direction must persist across several samples so hand and sensor
    // jitter cannot be mistaken for intentional navigation.
    const requiredTravel = source === "gyro" ? 1.6 : source === "touch" ? 10 : 4;
    const requiredSamples = source === "gyro" ? 4 : 2;

    if (
      directionTracking.candidateTravel < requiredTravel ||
      directionTracking.candidateSamples < requiredSamples
    ) {
      return;
    }

    const switchAccepted = requestDirectionalVideo(source);

    if (switchAccepted) {
      directionTracking.active = nextDirection;
    }

    resetDirectionCandidate();
  }

  function resetMotionEdges() {
    motionEdges = {
      left: false,
      right: false,
      top: false,
      bottom: false,
    };
  }

  function updateMotionEdges(normalizedTilt, tiltChange) {
    const enterThreshold = 0.985;
    const releaseThreshold = 0.9;
    const edgeChecks = [
      { name: "left", amount: -normalizedTilt.x, movement: -tiltChange.x },
      { name: "right", amount: normalizedTilt.x, movement: tiltChange.x },
      { name: "top", amount: -normalizedTilt.y, movement: -tiltChange.y },
      { name: "bottom", amount: normalizedTilt.y, movement: tiltChange.y },
    ];
    let enteredEdge = false;

    edgeChecks.forEach(({ name, amount, movement }) => {
      if (motionEdges[name]) {
        if (amount < releaseThreshold) {
          motionEdges[name] = false;
        }

        return;
      }

      if (amount >= enterThreshold && movement > 0.08) {
        // Latch the edge until the tilt moves clearly away from it.
        motionEdges[name] = true;
        enteredEdge = true;
      }
    });

    if (enteredEdge) {
      const switchAccepted = requestDirectionalVideo("gyro");

      if (switchAccepted) {
        resetDirectionTracking("gyro");
      } else {
        // Keep an edge eligible for another sample when the short navigation
        // cooldown prevented this attempt from being accepted.
        edgeChecks.forEach(({ name, amount }) => {
          if (amount >= enterThreshold) {
            motionEdges[name] = false;
          }
        });
      }
    }

    return Object.values(motionEdges).some(Boolean);
  }

  function nextAscendingProjectIndex(fromIndex = currentProjectIndex) {
    const currentIndex = ascendingProjectIndices.indexOf(fromIndex);

    if (currentIndex < 0) {
      return ascendingProjectIndices[0];
    }

    return ascendingProjectIndices[(currentIndex + 1) % ascendingProjectIndices.length];
  }

  function previousAscendingProjectIndex(fromIndex = currentProjectIndex) {
    const currentIndex = ascendingProjectIndices.indexOf(fromIndex);

    if (currentIndex < 0) {
      return ascendingProjectIndices[ascendingProjectIndices.length - 1];
    }

    return ascendingProjectIndices[
      (currentIndex - 1 + ascendingProjectIndices.length) % ascendingProjectIndices.length
    ];
  }

  function projectIndexForMode(mode) {
    if (mode === "descending") {
      return previousAscendingProjectIndex();
    }

    return nextAscendingProjectIndex();
  }

  function setProjectLabel(project) {
    projectNumber.textContent = String(project.order).padStart(2, "0");
    projectTitle.textContent = project.title;
    stage.dataset.projectIndex = String(project.order);
    stage.dataset.projectTitle = project.title;
    stage.dataset.projectSlug = project.slug;
    updateSidebarActive(project);
    frame.setAttribute("role", "button");
    frame.setAttribute("aria-haspopup", "dialog");
    frame.setAttribute("aria-label", `Open ${project.title} case study`);
    stage.setAttribute(
      "aria-label",
      `${project.title}, selected work. Press Enter to open the case study. Use arrow keys to browse projects.`
    );
  }

  function announceActiveProject(project = projects[currentProjectIndex]) {
    if (!project) {
      return;
    }

    window.dispatchEvent(new CustomEvent("kozi:projectchange", {
      detail: {
        project: { ...project },
        video: videos[activeSlotIndex],
        frame,
      },
    }));

    if (pendingSidebarProject?.slug === project.slug && !caseStudyActive) {
      const pendingProject = pendingSidebarProject;
      pendingSidebarProject = null;
      requestAnimationFrame(() => {
        if (!caseStudyActive && projects[currentProjectIndex]?.slug === project.slug) {
          openSidebarCase(pendingProject);
        }
      });
    }
  }

  function requestCaseStudyOpen() {
    if (caseStudyActive) {
      return;
    }

    const project = projects[currentProjectIndex];
    const activeVideo = videos[activeSlotIndex];

    if (!project) {
      return;
    }

    window.dispatchEvent(new CustomEvent("kozi:requestprojectopen", {
      detail: {
        slug: project.caseStudySlug,
        stageSlug: project.slug,
        project: { ...project },
        frame,
        video: activeVideo,
        currentTime: activeVideo.currentTime || 0,
      },
    }));
  }

  function setFrameRatio() {
    const ratio = 16 / 9;
    const preferredWidth = stage.clientWidth * (coarsePointer.matches ? 0.72 : 0.42);
    const maximumWidth = coarsePointer.matches ? Infinity : 720;
    const captionSpace = projectLabel.offsetHeight + 8;
    const availableWidth = Math.max(1, stage.clientWidth);
    const availableHeight = Math.max(1, stage.clientHeight - captionSpace);
    const width = Math.max(
      1,
      Math.min(preferredWidth, maximumWidth, availableWidth, availableHeight * ratio)
    );

    frame.style.setProperty("--video-ratio", String(ratio));
    frame.style.width = `${width}px`;
    frameSize = {
      width: frame.offsetWidth,
      height: frame.offsetHeight,
    };
    labelHeight = projectLabel.offsetHeight;
  }

  function loadVideo(slotIndex, projectIndex) {
    const video = videos[slotIndex];
    const project = projects[projectIndex];
    const token = loadTokens[slotIndex] + 1;

    loadTokens[slotIndex] = token;
    video.pause();
    video.classList.remove("is-active");
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("aria-label", project.title);
    video.dataset.projectIndex = String(projectIndex);
    video.preload = "auto";
    video.src = videoSource(project);
    video.load();

    return new Promise((resolve, reject) => {
      function cleanup() {
        video.removeEventListener("loadeddata", handleLoaded);
        video.removeEventListener("error", handleError);
      }

      function handleLoaded() {
        cleanup();

        if (loadTokens[slotIndex] !== token) {
          return;
        }

        resolve(video);
      }

      function handleError() {
        cleanup();

        if (loadTokens[slotIndex] !== token) {
          return;
        }

        reject(new Error(`Unable to load ${videoSource(project)}`));
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        handleLoaded();
        return;
      }

      video.addEventListener("loadeddata", handleLoaded);
      video.addEventListener("error", handleError);
    });
  }

  function playActiveVideo() {
    const activeVideo = videos[activeSlotIndex];

    videos.forEach((video, index) => {
      const borrowedPlayback =
        stageVideoBorrowed && !document.hidden && index === activeSlotIndex;

      if (
        borrowedPlayback ||
        (stageVisible && !caseStudyActive && !document.hidden && index === activeSlotIndex)
      ) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });

    return activeVideo;
  }

  async function queueNextVideo(projectIndex) {
    const slotIndex = activeSlotIndex === 0 ? 1 : 0;

    queuedProjectIndex = projectIndex;
    queuedReady = false;
    queuedLoading = true;

    try {
      await loadVideo(slotIndex, projectIndex);
    } catch (error) {
      console.error(error);

      if (queuedProjectIndex === projectIndex && slotIndex !== activeSlotIndex) {
        queuedLoading = false;
        queueNextVideo(projectIndex);
      }

      return;
    }

    if (
      queuedProjectIndex !== projectIndex ||
      Number(videos[slotIndex].dataset.projectIndex) !== projectIndex ||
      slotIndex === activeSlotIndex
    ) {
      return;
    }

    queuedLoading = false;
    queuedReady = true;

    if (switchRequest?.projectIndex === projectIndex) {
      switchVideo(switchRequest.mode, projectIndex, switchRequest.announce);
    }
  }

  function queueInitialNextVideo() {
    if (initialQueueStarted) {
      return;
    }

    initialQueueStarted = true;
    queueNextVideo(nextAscendingProjectIndex());
  }

  function queueInitialNextVideoNearMidpoint(video) {
    if (
      initialQueueStarted ||
      video !== videos[activeSlotIndex] ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.currentTime < video.duration * 0.5
    ) {
      return;
    }

    queueInitialNextVideo();
  }

  function switchVideo(mode = "ascending", requestedProjectIndex = null, announce = false) {
    const desiredProjectIndex =
      requestedProjectIndex ?? projectIndexForMode(mode);

    if (!queuedReady || queuedProjectIndex !== desiredProjectIndex) {
      switchRequest = { mode, projectIndex: desiredProjectIndex, announce };
      initialQueueStarted = true;
      stage.classList.add("is-awaiting");

      if (queuedProjectIndex !== desiredProjectIndex || !queuedLoading) {
        queueNextVideo(desiredProjectIndex);
      }

      return;
    }

    const outgoingSlotIndex = activeSlotIndex;
    const incomingSlotIndex = activeSlotIndex === 0 ? 1 : 0;
    const outgoingVideo = videos[outgoingSlotIndex];
    const incomingVideo = videos[incomingSlotIndex];
    const nextProject = projects[queuedProjectIndex];
    switchRequest = null;
    stage.classList.remove("is-awaiting");
    queuedReady = false;
    activeSlotIndex = incomingSlotIndex;
    currentProjectIndex = queuedProjectIndex;

    setFrameRatio(incomingVideo);
    setProjectLabel(nextProject);

    incomingVideo.classList.add("is-active");
    incomingVideo.setAttribute("aria-hidden", "false");
    outgoingVideo.classList.remove("is-active");
    outgoingVideo.setAttribute("aria-hidden", "true");
    outgoingVideo.pause();

    playActiveVideo();
    announceActiveProject(nextProject);

    if (announce) {
      stageStatus.textContent = `${String(nextProject.order).padStart(2, "0")} ${nextProject.title}`;
    }

    queueNextVideo(projectIndexForMode(mode));
  }

  videos.forEach((video) => {
    video.addEventListener("timeupdate", () => {
      queueInitialNextVideoNearMidpoint(video);
    });

    video.addEventListener("ended", () => {
      if (video !== videos[activeSlotIndex]) {
        return;
      }

      lastDirectionalSwitch = performance.now();
      resetDirectionTracking();
      switchVideo("ascending");
    });
  });

  function updateTargetFromPoint(clientX, clientY) {
    const bounds = stage.getBoundingClientRect();

    targetPosition = {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  }

  stage.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    const now = performance.now();

    if (!pointerActive || now - lastPointerInput > 3000) {
      pointerReentryTime = now;
    }

    pointerActive = true;
    lastPointerInput = now;
    lastUserActivity = lastPointerInput;
    pointerPosition = { x: event.clientX, y: event.clientY };
    resetDirectionTracking("pointer");
    updateTargetFromPoint(event.clientX, event.clientY);
  });

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch" || !touchDragging) {
      return;
    }

    lastUserActivity = performance.now();
    let distance = 0;
    let deltaX = 0;
    let deltaY = 0;

    if (touchPosition) {
      deltaX = event.clientX - touchPosition.x;
      deltaY = event.clientY - touchPosition.y;
      distance = Math.hypot(deltaX, deltaY);
      touchTravel += distance;
    }

    updateTargetFromPoint(event.clientX, event.clientY);
    trackMovementDirection(deltaX, deltaY, "touch");
    touchPosition = { x: event.clientX, y: event.clientY };
  });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    const now = performance.now();

    if (!pointerActive || now - lastPointerInput > 3000) {
      pointerReentryTime = now;
    }

    pointerActive = true;
    lastPointerInput = now;
    lastUserActivity = lastPointerInput;
    updateTargetFromPoint(event.clientX, event.clientY);

    if (pointerPosition) {
      trackMovementDirection(
        event.clientX - pointerPosition.x,
        event.clientY - pointerPosition.y,
        "pointer"
      );
    }

    pointerPosition = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "touch") {
      pointerActive = false;
      pointerPosition = null;
      resetDirectionTracking();
    }
  });

  window.addEventListener("blur", () => {
    pointerActive = false;
    pointerPosition = null;
    resetDirectionTracking();
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }

    touchDragging = true;
    pointerActive = true;
    touchTravel = 0;
    suppressClick = false;
    lastUserActivity = performance.now();
    touchPosition = { x: event.clientX, y: event.clientY };
    touchStartPosition = { ...touchPosition };
    resetDirectionTracking("touch");
    updateTargetFromPoint(event.clientX, event.clientY);
    stage.setPointerCapture(event.pointerId);
  });

  function endTouchDrag(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    touchDragging = false;
    pointerActive = false;
    lastUserActivity = performance.now();
    touchPosition = null;
    touchStartPosition = null;
    suppressClick = event.type !== "pointercancel" && touchTravel > 10;

    if (suppressClick) {
      window.setTimeout(() => {
        suppressClick = false;
      }, 500);
    }

    if (motionListening) {
      resetMotionCalibration();
    }
  }

  stage.addEventListener("pointerup", endTouchDrag);
  stage.addEventListener("pointercancel", endTouchDrag);

  stage.addEventListener("click", (event) => {
    if (event.target.closest?.(".motion-permission")) {
      return;
    }

    if (suppressClick) {
      suppressClick = false;
      return;
    }

    if (!event.target.closest?.("[data-video-frame]")) {
      return;
    }

    lastUserActivity = performance.now();
    requestCaseStudyOpen();
  });

  stage.addEventListener("keydown", (event) => {
    if (
      caseStudyActive ||
      event.target.closest?.(".motion-permission") ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    lastUserActivity = performance.now();

    if (event.key === " " || event.key === "Enter") {
      requestCaseStudyOpen();
      return;
    }

    switchVideo(
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? "descending"
        : "ascending",
      null,
      true
    );
  });

  let digitBuffer = "";
  let digitTimer = 0;
  const maximumOrder = projects.reduce(
    (max, project) => Math.max(max, project.order),
    0
  );

  function commitDigitBuffer() {
    window.clearTimeout(digitTimer);
    const order = digitBuffer === "0" ? 10 : Number(digitBuffer);
    digitBuffer = "";
    const projectIndex = projects.findIndex((project) => project.order === order);

    if (projectIndex < 0 || projectIndex === currentProjectIndex) {
      return;
    }

    lastUserActivity = performance.now();
    switchVideo("ascending", projectIndex, true);
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isEditable =
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    if (
      caseStudyActive ||
      isEditable ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !/^[0-9]$/.test(event.key)
    ) {
      return;
    }

    digitBuffer += event.key;
    window.clearTimeout(digitTimer);

    // Commit as soon as no further digit could name a project ("2" cannot
    // grow into a valid number when only 15 exist); otherwise wait briefly
    // for a second digit so tapping "1","1" reads as project 11.
    if (digitBuffer.length >= 2 || Number(digitBuffer) * 10 > maximumOrder) {
      commitDigitBuffer();
    } else {
      digitTimer = window.setTimeout(commitDigitBuffer, 250);
    }
  });

  window.addEventListener("kozi:casestudystate", (event) => {
    const caseStudyClosing = Boolean(event.detail?.closing);

    if (event.detail?.preserveStageVideo) {
      stageVideoBorrowed = true;
    }

    caseStudyActive = Boolean(event.detail?.open) || caseStudyClosing;
    stage.classList.toggle("is-case-open", caseStudyActive);
    stage.classList.toggle("is-case-closing", caseStudyClosing);

    if (!event.detail?.open && !caseStudyClosing) {
      updateSidebarCaseActive();
    }

    if (caseStudyActive) {
      pointerActive = false;
      touchDragging = false;
      stage.classList.remove("is-awaiting");
      clearTrail();
    } else {
      const handoffTime = Number(event.detail?.currentTime);
      const activeVideo = videos[activeSlotIndex];

      if (
        !event.detail?.continuousVideo &&
        Number.isFinite(handoffTime) &&
        handoffTime >= 0 &&
        event.detail?.slug === stage.dataset.projectSlug
      ) {
        const syncHandoffTime = () => {
          if (!Number.isFinite(activeVideo.duration) || activeVideo.duration <= 0) {
            return;
          }

          try {
            activeVideo.currentTime = handoffTime % activeVideo.duration;
          } catch {
            // Seeking can briefly be unavailable while a newly selected video loads.
          }
        };

        if (activeVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
          syncHandoffTime();
        } else {
          activeVideo.addEventListener("loadedmetadata", syncHandoffTime, { once: true });
        }
      }

      const resumedAt = performance.now();

      if (pointerPosition && !coarsePointer.matches) {
        pointerActive = true;
        lastPointerInput = resumedAt;
        // Start the soft reacquire ramp from zero so the frame glides back to
        // the cursor after a case study closes instead of lunging at it.
        pointerReentryTime = resumedAt;
        updateTargetFromPoint(pointerPosition.x, pointerPosition.y);
        resetDirectionTracking("pointer");
      } else {
        pointerActive = false;
        pointerPosition = null;
        lastPointerInput = 0;
        pointerReentryTime = resumedAt;
        targetPosition = { ...currentPosition };
      }

      lastUserActivity = resumedAt;
      idleLastTime = lastUserActivity;
    }

    playActiveVideo();
  });

  window.addEventListener("kozi:stagevideohandoff", (event) => {
    stageVideoBorrowed = Boolean(event.detail?.active);
    playActiveVideo();
  });

  window.addEventListener("kozi:requeststageproject", (event) => {
    const requestedSlug = event.detail?.slug;
    const requestedIndex = projects.findIndex((project) => project.slug === requestedSlug);

    if (requestedIndex < 0 || requestedIndex === currentProjectIndex) {
      return;
    }

    switchVideo("ascending", requestedIndex);
  });

  function screenOrientationAngle() {
    return Number(window.screen.orientation?.angle ?? window.orientation ?? 0);
  }

  function mapTilt(betaDelta, gammaDelta) {
    const angle = ((screenOrientationAngle() % 360) + 360) % 360;

    if (angle === 90) {
      return { x: betaDelta, y: -gammaDelta };
    }

    if (angle === 180) {
      return { x: -gammaDelta, y: -betaDelta };
    }

    if (angle === 270) {
      return { x: -betaDelta, y: gammaDelta };
    }

    return { x: gammaDelta, y: betaDelta };
  }

  function mapTiltToAxis(amount, start, minimum, maximum) {
    return amount < 0
      ? start + (start - minimum) * amount
      : start + (maximum - start) * amount;
  }

  function resetMotionCalibration() {
    baseOrientation = null;
    motionOrigin = { ...currentPosition };
    lastTiltPosition = null;
    targetPosition = { ...currentPosition };
    resetMotionEdges();
    resetDirectionTracking("gyro");
  }

  function handleOrientation(event) {
    if (
      !stageVisible ||
      caseStudyActive ||
      touchDragging ||
      event.beta == null ||
      event.gamma == null
    ) {
      return;
    }

    if (!baseOrientation) {
      baseOrientation = { beta: event.beta, gamma: event.gamma };
      motionOrigin = { ...currentPosition };
      lastTiltPosition = { x: 0, y: 0 };
      targetPosition = { ...currentPosition };
      lastMotionInput = performance.now();
      lastUserActivity = lastMotionInput;
      return;
    }

    const betaDelta = event.beta - baseOrientation.beta;
    const gammaDelta = event.gamma - baseOrientation.gamma;
    const mapped = mapTilt(betaDelta, gammaDelta);
    const maximumTilt = 18;
    const clamped = {
      x: Math.max(-maximumTilt, Math.min(maximumTilt, mapped.x)),
      y: Math.max(-maximumTilt, Math.min(maximumTilt, mapped.y)),
    };
    const movementBounds = getMovementBounds();
    const origin = clampPosition(motionOrigin || currentPosition, movementBounds);
    const normalizedTilt = {
      x: clamped.x / maximumTilt,
      y: clamped.y / maximumTilt,
    };
    targetPosition = {
      x: mapTiltToAxis(
        normalizedTilt.x,
        origin.x,
        movementBounds.minX,
        movementBounds.maxX
      ),
      y: mapTiltToAxis(
        normalizedTilt.y,
        origin.y,
        movementBounds.minY,
        movementBounds.maxY
      ),
    };

    if (lastTiltPosition) {
      const tiltChange = {
        x: clamped.x - lastTiltPosition.x,
        y: clamped.y - lastTiltPosition.y,
      };
      const tiltDelta = Math.hypot(
        tiltChange.x,
        tiltChange.y
      );

      if (tiltDelta > 0.2) {
        lastMotionInput = performance.now();
        lastUserActivity = lastMotionInput;
      }

      if (updateMotionEdges(normalizedTilt, tiltChange)) {
        resetDirectionCandidate();
      } else {
        trackMovementDirection(tiltChange.x, tiltChange.y, "gyro");
      }
    }

    lastTiltPosition = clamped;
  }

  function startMotionInput() {
    if (motionListening) {
      return;
    }

    window.addEventListener("deviceorientation", handleOrientation, true);
    motionListening = true;

    if (motionButton) {
      motionButton.classList.add("is-hidden");
    }
  }

  function handleShake(event) {
    if (document.hidden) {
      return;
    }

    const directAcceleration = event.acceleration;
    const includesGravity = event.accelerationIncludingGravity;
    const acceleration =
      directAcceleration?.x != null ? directAcceleration : includesGravity;

    if (acceleration?.x == null || acceleration?.y == null || acceleration?.z == null) {
      return;
    }

    const magnitude = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
    const force = acceleration === directAcceleration
      ? magnitude
      : Math.abs(magnitude - 9.81);
    const now = performance.now();

    if (now - shakeWindowStart > 900) {
      shakeWindowStart = now;
      shakePeakCount = 0;
    }

    if (force < 12 || now - lastShakePeak < 110) {
      return;
    }

    lastShakePeak = now;
    shakePeakCount += 1;

    if (shakePeakCount < 2 || now - lastShakeToggle < 1400) {
      return;
    }

    shakePeakCount = 0;
    lastShakeToggle = now;
    toggleThemeInversion();
  }

  function startShakeInput() {
    if (shakeListening || !coarsePointer.matches) {
      return;
    }

    window.addEventListener("devicemotion", handleShake, { passive: true });
    shakeListening = true;

    if (motionButton) {
      motionButton.classList.add("is-hidden");
    }
  }

  async function requestMotionPermission() {
    const OrientationEvent = window.DeviceOrientationEvent;
    const MotionEvent = window.DeviceMotionEvent;

    try {
      const orientationRequest =
        typeof OrientationEvent?.requestPermission === "function"
          ? OrientationEvent.requestPermission()
          : Promise.resolve(OrientationEvent ? "granted" : "unavailable");
      const motionRequest =
        coarsePointer.matches && typeof MotionEvent?.requestPermission === "function"
          ? MotionEvent.requestPermission()
          : Promise.resolve(MotionEvent ? "granted" : "unavailable");
      const [orientationPermission, motionPermission] = await Promise.all([
        orientationRequest,
        motionRequest,
      ]);

      if (orientationPermission === "granted") {
        startMotionInput();
      }

      if (motionPermission === "granted") {
        startShakeInput();
      }

      if (
        orientationPermission !== "granted" &&
        motionPermission !== "granted" &&
        motionButton
      ) {
        motionButton.classList.add("is-hidden");
        stageStatus.textContent = "Motion access declined. Touch drag remains available.";
      }
    } catch (error) {
      console.error(error);

      if (motionButton) {
        motionButton.classList.add("is-hidden");
      }

      stageStatus.textContent = "Motion access unavailable. Touch drag remains available.";
    }
  }

  if (motionButton) {
    motionButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    motionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      requestMotionPermission();
    });
  }

  const OrientationEvent = window.DeviceOrientationEvent;
  const MotionEvent = window.DeviceMotionEvent;
  const motionPermissionRequired =
    typeof OrientationEvent?.requestPermission === "function" ||
    typeof MotionEvent?.requestPermission === "function";

  if (motionPermissionRequired) {
    if (motionButton && coarsePointer.matches) {
      motionButton.hidden = false;
    }
  } else {
    if (OrientationEvent) {
      startMotionInput();
    }

    if (MotionEvent) {
      startShakeInput();
    }
  }

  window.addEventListener("orientationchange", resetMotionCalibration);
  window.screen.orientation?.addEventListener?.("change", resetMotionCalibration);

  function resetFramePosition() {
    setFrameRatio(videos[activeSlotIndex]);
    const targetBounds = getMovementBounds();

    currentPosition = clampPosition(currentPosition, targetBounds);
    targetPosition = { ...currentPosition };
    idlePosition = { ...currentPosition };
    idleLastTime = performance.now();
    lastTrailPosition = { ...currentPosition };
    previousFramePosition = { ...currentPosition };
    previousFrameTime = idleLastTime;
    frameVelocity = { ...idleVelocity };
    resetMotionCalibration();
  }

  window.addEventListener("resize", resetFramePosition);

  function emitTrail(
    frameWidth,
    frameHeight,
    {
      position = currentPosition,
      startOpacity = 0.14,
      middleOpacity = 0.045,
      middleScale = 0.86,
      endScale = 0.72,
      duration = 1050,
      delay = 0,
      velocity = frameVelocity,
    } = {}
  ) {
    const activeVideo = videos[activeSlotIndex];

    if (
      reduceMotion ||
      trailCanvases.length === 0 ||
      activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !activeVideo.videoWidth ||
      !activeVideo.videoHeight
    ) {
      return;
    }

    const canvas = trailCanvases[trailCursor % trailCanvases.length];
    const ratio = 16 / 9;
    const sourceRatio = activeVideo.videoWidth / activeVideo.videoHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = activeVideo.videoWidth;
    let sourceHeight = activeVideo.videoHeight;

    if (sourceRatio > ratio) {
      sourceWidth = sourceHeight * ratio;
      sourceX = (activeVideo.videoWidth - sourceWidth) / 2;
    } else if (sourceRatio < ratio) {
      sourceHeight = sourceWidth / ratio;
      sourceY = (activeVideo.videoHeight - sourceHeight) / 2;
    }

    const renderWidth = Math.max(1, Math.min(300, Math.round(frameWidth)));
    const renderHeight = Math.max(1, Math.round(renderWidth / ratio));
    const context = canvas.getContext("2d", { alpha: false });

    trailCursor += 1;

    if (!context) {
      return;
    }

    if (canvas.width !== renderWidth) {
      canvas.width = renderWidth;
    }

    if (canvas.height !== renderHeight) {
      canvas.height = renderHeight;
    }

    try {
      context.drawImage(
        activeVideo,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        renderWidth,
        renderHeight
      );
    } catch {
      return;
    }

    canvas.style.width = `${frameWidth}px`;
    canvas.style.height = `${frameHeight}px`;
    const suppliedSpeed = Math.hypot(velocity.x, velocity.y);
    const effectiveVelocity = suppliedSpeed >= 1 ? velocity : idleVelocity;
    const speed = Math.max(1, Math.hypot(effectiveVelocity.x, effectiveVelocity.y));
    const direction = {
      x: effectiveVelocity.x / speed,
      y: effectiveVelocity.y / speed,
    };
    const dynamicStrength = Math.min(1, speed / 700);
    const driftDistance = 3 + dynamicStrength * 12;
    const originReach = 34 + dynamicStrength * 12;
    const baseX = position.x - frameWidth / 2;
    const baseY = position.y - frameHeight / 2;
    const middleX = baseX - direction.x * driftDistance * 0.42;
    const middleY = baseY - direction.y * driftDistance * 0.42;
    const endX = baseX - direction.x * driftDistance;
    const endY = baseY - direction.y * driftDistance;

    canvas.style.transformOrigin = `${50 - direction.x * originReach}% ${
      50 - direction.y * originReach
    }%`;
    canvas.style.transform = `translate3d(${baseX}px, ${baseY}px, 0) scale(1)`;

    canvas.getAnimations().forEach((animation) => animation.cancel());
    canvas.animate(
      [
        {
          opacity: startOpacity,
          transform: `translate3d(${baseX}px, ${baseY}px, 0) scale(1)`,
        },
        {
          opacity: middleOpacity,
          transform: `translate3d(${middleX}px, ${middleY}px, 0) scale(${middleScale})`,
          offset: 0.58,
        },
        {
          opacity: 0,
          transform: `translate3d(${endX}px, ${endY}px, 0) scale(${endScale})`,
        },
      ],
      {
        delay,
        duration,
        easing: "linear",
        fill: "forwards",
      }
    );
  }

  function clearTrail() {
    trailCanvases.forEach((canvas) => {
      if (document.hidden) {
        canvas.getAnimations().forEach((animation) => animation.cancel());
        canvas.style.opacity = "0";
        return;
      }

      const opacity = Number(window.getComputedStyle(canvas).opacity);
      canvas.getAnimations().forEach((animation) => animation.cancel());
      canvas.style.opacity = "0";

      if (opacity > 0.001) {
        canvas.animate(
          [{ opacity }, { opacity: 0 }],
          { duration: 250, easing: "ease-out", fill: "forwards" }
        );
      }
    });
  }

  function chooseIdleCurve(now) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const nearlyStraight = Math.random() < 0.16 ? 0.2 : 1;

    idleTargetTurnRate =
      direction * (0.045 + Math.random() * 0.17) * nearlyStraight;
    idleNextSteerTime = now + 2200 + Math.random() * 3600;
  }

  function rotateIdleVelocity(angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = idleVelocity.x * cosine - idleVelocity.y * sine;
    const y = idleVelocity.x * sine + idleVelocity.y * cosine;

    idleVelocity = { x, y };
  }

  function advanceIdlePosition(now, bounds) {
    if (!idlePosition) {
      idlePosition = clampPosition(currentPosition, bounds);
      idleLastTime = now;
    }

    const deltaTime = Math.min(0.05, Math.max(0, (now - idleLastTime) / 1000));
    let bounced = false;

    idleLastTime = now;

    if (now >= idleNextSteerTime) {
      chooseIdleCurve(now);
    }

    const steeringEasing = 1 - Math.exp(-deltaTime * 0.9);
    idleTurnRate += (idleTargetTurnRate - idleTurnRate) * steeringEasing;
    rotateIdleVelocity(idleTurnRate * deltaTime);
    idlePosition.x += idleVelocity.x * deltaTime;
    idlePosition.y += idleVelocity.y * deltaTime;

    if (idlePosition.x <= bounds.minX) {
      idlePosition.x = bounds.minX + (bounds.minX - idlePosition.x);
      idleVelocity.x = Math.abs(idleVelocity.x);
      bounced = true;
    } else if (idlePosition.x >= bounds.maxX) {
      idlePosition.x = bounds.maxX - (idlePosition.x - bounds.maxX);
      idleVelocity.x = -Math.abs(idleVelocity.x);
      bounced = true;
    }

    if (idlePosition.y <= bounds.minY) {
      idlePosition.y = bounds.minY + (bounds.minY - idlePosition.y);
      idleVelocity.y = Math.abs(idleVelocity.y);
      bounced = true;
    } else if (idlePosition.y >= bounds.maxY) {
      idlePosition.y = bounds.maxY - (idlePosition.y - bounds.maxY);
      idleVelocity.y = -Math.abs(idleVelocity.y);
      bounced = true;
    }

    if (bounced) {
      rotateIdleVelocity((Math.random() - 0.5) * 0.34);
      chooseIdleCurve(now);
      requestDirectionalVideo("idle");
    }

    return clampPosition(idlePosition, bounds);
  }

  function animateFrame(now = performance.now()) {
    // While the case-study overlay covers the stage there is nothing to move;
    // skip the easing math and style writes until it closes.
    if (caseStudyActive) {
      previousFramePosition = { ...currentPosition };
      previousFrameTime = now;
      requestAnimationFrame(animateFrame);
      return;
    }

    const frameWidth = frameSize.width;
    const frameHeight = frameSize.height;
    const captionGap = 8;
    const captionEdgeInset = 8;
    const bounds = getMovementBounds(frameWidth, frameHeight);
    const center = clampPosition(stageAnchor(), bounds);
    const pointerOverride =
      touchDragging || (pointerActive && now - lastPointerInput < 3000);
    const motionOverride =
      !pointerOverride && motionListening && lastMotionInput > 0;
    const inputOverride = pointerOverride || motionOverride;
    const pointerReentryProgress = Math.min(
      1,
      Math.max(0, now - pointerReentryTime) / 1100
    );
    const pointerEasing = 0.035 + pointerReentryProgress * 0.085;
    const desired = reduceMotion
      ? center
      : inputOverride
        ? targetPosition
        : advanceIdlePosition(now, bounds);
    const clampedTarget = clampPosition(desired, bounds);
    const easing = reduceMotion
      ? 1
      : inputOverride
        ? pointerOverride
          ? pointerEasing
          : 0.085
        : 1;

    currentPosition.x += (clampedTarget.x - currentPosition.x) * easing;
    currentPosition.y += (clampedTarget.y - currentPosition.y) * easing;
    currentPosition = clampPosition(currentPosition, bounds);

    if (inputOverride) {
      idlePosition = { ...currentPosition };
      idleLastTime = now;
      idleNextSteerTime = now;
    }

    const frameDeltaTime = Math.min(
      0.05,
      Math.max(0.001, (now - previousFrameTime) / 1000)
    );
    const rawVelocity = {
      x: (currentPosition.x - previousFramePosition.x) / frameDeltaTime,
      y: (currentPosition.y - previousFramePosition.y) / frameDeltaTime,
    };
    const velocityEasing = inputOverride ? 0.28 : 0.42;

    frameVelocity.x += (rawVelocity.x - frameVelocity.x) * velocityEasing;
    frameVelocity.y += (rawVelocity.y - frameVelocity.y) * velocityEasing;
    previousFramePosition = { ...currentPosition };
    previousFrameTime = now;

    frame.style.transform = `translate3d(${currentPosition.x - frameWidth / 2}px, ${
      currentPosition.y - frameHeight / 2
    }px, 0)`;
    const preferredLabelY = currentPosition.y + frameHeight / 2 + captionGap;
    const maximumLabelY = Math.max(
      captionEdgeInset,
      stage.clientHeight - labelHeight - captionEdgeInset
    );
    const labelY = Math.min(preferredLabelY, maximumLabelY);

    projectLabel.style.maxWidth = `${frameWidth}px`;
    projectLabel.style.transform = `translate3d(${currentPosition.x - frameWidth / 2}px, ${
      labelY
    }px, 0)`;

    if (!lastTrailPosition) {
      lastTrailPosition = { ...currentPosition };
    }

    const distanceSinceTrail = Math.hypot(
      currentPosition.x - lastTrailPosition.x,
      currentPosition.y - lastTrailPosition.y
    );
    const idleTrailProgress = inputOverride
      ? 0
      : Math.min(1, Math.max(0, now - lastUserActivity) / idleTrailRampDuration);
    const idleTrailGrowth = 1 - Math.pow(1 - idleTrailProgress, 3);
    const idleTrailDuration =
      idleTrailMinimumDuration +
      idleTrailGrowth * (idleTrailMaximumDuration - idleTrailMinimumDuration);
    // As snapshots live longer, sample them farther apart so the trail can span
    // much more time without increasing the maximum number of animated canvases.
    const idleTrailInterval = Math.max(
      28,
      idleTrailDuration / Math.max(1, trailCanvases.length - trailPoolReserve)
    );
    const trailInterval = inputOverride ? 16 : idleTrailInterval;
    const trailDistance = inputOverride ? 0.55 : 1.1;

    if (
      stageVisible &&
      now - lastTrailTime >= trailInterval &&
      distanceSinceTrail >= trailDistance
    ) {
      emitTrail(frameWidth, frameHeight, {
        velocity: frameVelocity,
        startOpacity: inputOverride ? 0.2 : 0.11 + idleTrailGrowth * 0.015,
        middleOpacity: inputOverride ? 0.075 : 0.035 + idleTrailGrowth * 0.01,
        middleScale: inputOverride ? 0.86 : 0.94,
        endScale: inputOverride ? 0.7 : 0.72 - idleTrailGrowth * 0.06,
        duration: inputOverride ? 1300 : idleTrailDuration,
      });
      lastTrailTime = now;
      lastTrailPosition = { ...currentPosition };
    }

    requestAnimationFrame(animateFrame);
  }

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      stageVisible = entry.isIntersecting && entry.intersectionRatio >= 0.2;

      if (stageVisible) {
        resetMotionCalibration();
      } else {
        clearTrail();
      }

      playActiveVideo();
    },
    { threshold: [0, 0.2, 0.5] }
  );

  visibilityObserver.observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTrail();
    }

    playActiveVideo();
  });

  // Low Power Mode (and similar policies) block autoplay until a user gesture.
  // These capture-phase listeners carry user activation, so the first tap or
  // key press anywhere restores playback without any visible affordance.
  function retryBlockedPlayback() {
    if (caseStudyActive || document.hidden || !stageVisible) {
      return;
    }

    if (videos[activeSlotIndex].paused) {
      playActiveVideo();
    }
  }

  ["pointerdown", "touchstart", "keydown"].forEach((type) => {
    window.addEventListener(type, retryBlockedPlayback, { capture: true, passive: true });
  });

  const initialProjectSlug = document.body.dataset.initialProject;
  const initialProjectIndex = initialProjectSlug
    ? projects.findIndex((project) => project.slug === initialProjectSlug)
    : -1;
  currentProjectIndex = initialProjectIndex >= 0
    ? initialProjectIndex
    : nextAscendingProjectIndex(-1);
  const firstProject = projects[currentProjectIndex];
  setProjectLabel(firstProject);
  videos[1].setAttribute("aria-hidden", "true");

  const firstVideo = await loadVideo(activeSlotIndex, currentProjectIndex);
  setFrameRatio(firstVideo);
  firstVideo.classList.add("is-active");
  firstVideo.setAttribute("aria-hidden", "false");
  stage.classList.add("is-ready");
  hideLoading();
  playActiveVideo();
  announceActiveProject(firstProject);
  stage.addEventListener("pointermove", queueInitialNextVideo, { once: true, passive: true });
  stage.addEventListener("pointerdown", queueInitialNextVideo, { once: true, passive: true });
  stage.addEventListener("touchstart", queueInitialNextVideo, { once: true, passive: true });
  stage.addEventListener("keydown", queueInitialNextVideo, { once: true });
  animateFrame();
}
