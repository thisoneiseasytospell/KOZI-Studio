const caseStudyLayer = document.querySelector("[data-case-study-layer]");
const caseStudyBackdrop = document.querySelector(".case-study-backdrop");
const caseStudyDialog = document.querySelector("[data-case-study-dialog]");
const caseStudyScroll = document.querySelector("[data-case-scroll]");
const caseStudyArticle = document.querySelector("[data-case-article]");
const caseStudyContent = document.querySelector("[data-case-content]");
const caseStudyClose = document.querySelector("[data-case-close]");
const caseHeadingNumber = document.querySelector("[data-case-heading-number]");
const caseStudyTitle = document.querySelector("[data-case-title]");
const caseStudySummary = document.querySelector("[data-case-summary]");
const caseStudyInformation = document.querySelector("[data-case-information]");
const caseServicesSection = document.querySelector("[data-case-services-section]");
const caseServices = document.querySelector("[data-case-services]");
const caseCreditsSection = document.querySelector("[data-case-credits-section]");
const caseCredits = document.querySelector("[data-case-credits]");
const caseHero = document.querySelector("[data-case-hero]");
const caseHeroVideo = document.querySelector("[data-case-hero-video]");
const caseHeroToggle = document.querySelector("[data-case-hero-toggle]");
const caseGallery = document.querySelector("[data-case-gallery]");
const caseProjectList = document.querySelector("[data-case-project-list]");
const caseStatus = document.querySelector("[data-case-status]");

if (
  caseStudyLayer &&
  caseStudyBackdrop &&
  caseStudyDialog &&
  caseStudyScroll &&
  caseStudyArticle &&
  caseStudyContent &&
  caseStudyClose &&
  caseStudyTitle &&
  caseHero &&
  caseHeroVideo &&
  caseHeroToggle &&
  caseProjectList
) {
  setupCaseStudies().catch((error) => {
    console.error(error);
    caseStatus.textContent = "Case studies are unavailable.";
  });
}

async function setupCaseStudies() {
  const accordionCollapseDuration = 160;
  const accordionExpandDuration = 280;
  const caseScrollDuration = 240;
  const reduceCaseMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactCaseMedia = window.matchMedia("(max-width: 760px), (hover: none), (pointer: coarse)");
  const response = await fetch("/assets/projects/index.json?v=1");

  if (!response.ok) {
    throw new Error(`Unable to load project index: ${response.status}`);
  }

  const index = await response.json();
  const projects = Array.isArray(index) ? index : index.projects;

  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error("The project index does not contain any projects.");
  }

  projects.sort((first, second) => first.order - second.order);

  const details = new Map();
  const detailRequests = new Map();
  const visibleVideos = new Set();
  const backgroundRegions = [
    document.querySelector(".site-intro"),
    document.querySelector("main"),
  ].filter(Boolean);
  const homeMetadata = {
    title: "KOZI Studio | Albert Kozikowski",
    description:
      "Albert Kozikowski is a freelance art director and designer, curious observer and AI optimist, oscillating between Norway and the Netherlands.",
    canonical: "https://www.kozi.studio/",
    robots: "index, follow, max-image-preview:large",
  };
  let activeSlug = null;
  let activeProject = null;
  let isOpen = false;
  let loadToken = 0;
  let lastFocusedElement = null;
  let openedFromHomepage = false;
  let caseHistoryDepth = 0;
  let videoObserver = null;
  let closeAfterHistoryChange = false;
  let ghostAnimation = null;
  let scrollAnimationFrame = 0;
  let isProjectSwitching = false;
  let queuedProjectRequest = null;
  let hoverHue = Math.random() * 360;

  function projectForSlug(slug) {
    return projects.find((project) => project.slug === slug) || null;
  }

  function slugFromLocation() {
    const match = window.location.pathname.match(/^\/work\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function mediaSource(media) {
    return compactCaseMedia.matches
      ? media.mobileSrc || media.desktopSrc || media.src
      : media.desktopSrc || media.mobileSrc || media.src;
  }

  function ratioValue(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const parts = value.split("/").map((part) => Number(part.trim()));

      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        return parts[0] / parts[1];
      }

      const numeric = Number(value);

      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }

    return 16 / 9;
  }

  function formatProjectNumber(order) {
    return String(order).padStart(2, "0");
  }

  async function loadProject(slug) {
    if (details.has(slug)) {
      return details.get(slug);
    }

    if (detailRequests.has(slug)) {
      return detailRequests.get(slug);
    }

    const summary = projectForSlug(slug);

    if (!summary) {
      throw new Error(`Unknown project: ${slug}`);
    }

    const request = (async () => {
      const projectResponse = await fetch(summary.detailPath);

      if (!projectResponse.ok) {
        throw new Error(`Unable to load ${slug}: ${projectResponse.status}`);
      }

      const project = await projectResponse.json();

      if (project.slug !== slug) {
        throw new Error(`Project data mismatch for ${slug}.`);
      }

      details.set(slug, project);
      return project;
    })();

    detailRequests.set(slug, request);

    try {
      return await request;
    } finally {
      if (detailRequests.get(slug) === request) {
        detailRequests.delete(slug);
      }
    }
  }

  function prefetchProjectData(slug) {
    if (!projectForSlug(slug)) {
      return;
    }

    loadProject(slug).catch(() => {
      // A foreground request can retry if an idle prefetch fails.
    });
  }

  async function prefetchRemainingProjectData() {
    const pendingSlugs = projects
      .map((project) => project.slug)
      .filter((slug) => !details.has(slug));
    let nextIndex = 0;

    async function prefetchNext() {
      while (nextIndex < pendingSlugs.length) {
        const slug = pendingSlugs[nextIndex];
        nextIndex += 1;

        try {
          await loadProject(slug);
        } catch {
          // Keep the idle queue moving; foreground loading remains retryable.
        }
      }
    }

    const workerCount = Math.min(3, pendingSlugs.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => prefetchNext())
    );
  }

  function scheduleProjectDataPrefetch() {
    const prefetch = () => {
      prefetchRemainingProjectData().catch(() => {});
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(prefetch, { timeout: 2500 });
    } else {
      window.setTimeout(prefetch, 1200);
    }
  }

  function updateMetadata(project = null) {
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const canonical = document.querySelector('link[rel="canonical"]');

    if (!project) {
      document.title = homeMetadata.title;
      descriptionMeta?.setAttribute("content", homeMetadata.description);
      robotsMeta?.setAttribute("content", homeMetadata.robots);
      canonical?.setAttribute("href", homeMetadata.canonical);
      return;
    }

    const description = project.summary?.trim()
      ? project.summary.trim()
      : `Case study: ${project.title} by Albert Kozikowski.`;

    document.title = `${project.title} | KOZI Studio`;
    descriptionMeta?.setAttribute("content", description);
    robotsMeta?.setAttribute("content", "noindex, follow, max-image-preview:large");
    canonical?.setAttribute(
      "href",
      `https://www.kozi.studio/work/${project.slug}/`
    );
  }

  function setBackgroundInert(value) {
    backgroundRegions.forEach((region) => {
      region.inert = value;

      if (value) {
        region.setAttribute("aria-hidden", "true");
      } else {
        region.removeAttribute("aria-hidden");
      }
    });
  }

  function syncVideoButton(video, button) {
    const paused = video.paused || video.dataset.userPaused === "true";
    button.textContent = paused ? "Play" : "Pause";
    button.setAttribute(
      "aria-label",
      `${paused ? "Play" : "Pause"} ${video.getAttribute("aria-label") || "project video"}`
    );
    button.classList.toggle("is-paused", paused);
  }

  function shouldVideoPlay(video) {
    return (
      isOpen &&
      !document.hidden &&
      !caseStudyLayer.classList.contains("is-ghosting") &&
      visibleVideos.has(video) &&
      video.dataset.userPaused !== "true"
    );
  }

  function syncVideoPlayback(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;

    if (shouldVideoPlay(video)) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }

    const button = video.closest(".case-study-hero, .case-study-media")
      ?.querySelector(".case-video-toggle");

    if (button) {
      syncVideoButton(video, button);
    }
  }

  function bindVideoControl(video, button) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.dataset.userPaused = "false";
    video.addEventListener("volumechange", () => {
      if (!video.muted || video.volume !== 0) {
        video.muted = true;
        video.volume = 0;
      }
    });
    video.addEventListener("play", () => syncVideoButton(video, button));
    video.addEventListener("pause", () => syncVideoButton(video, button));
    button.addEventListener("click", () => {
      const userPaused = video.dataset.userPaused === "true";
      video.dataset.userPaused = String(!userPaused);

      if (userPaused) {
        visibleVideos.add(video);
      }

      syncVideoPlayback(video);
    });
    syncVideoButton(video, button);
  }

  function setupVideoObserver() {
    videoObserver?.disconnect();
    visibleVideos.clear();
    videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.32) {
            visibleVideos.add(video);
          } else {
            visibleVideos.delete(video);
          }

          syncVideoPlayback(video);
        });
      },
      {
        root: caseStudyScroll,
        threshold: [0, 0.32, 0.7],
      }
    );

    caseStudyDialog.querySelectorAll("video").forEach((video) => {
      videoObserver.observe(video);
    });
  }

  function pauseAllCaseVideos() {
    caseStudyDialog.querySelectorAll("video").forEach((video) => video.pause());
  }

  function sizeHero() {
    if (!activeProject || !isOpen) {
      return;
    }

    const ratio = ratioValue(activeProject.hero.aspectRatio);
    const articleStyle = window.getComputedStyle(caseStudyArticle);
    const horizontalPadding =
      Number.parseFloat(articleStyle.paddingLeft) +
      Number.parseFloat(articleStyle.paddingRight);
    const availableWidth = Math.max(1, caseStudyDialog.clientWidth - horizontalPadding);
    const availableHeight = Math.max(260, window.innerHeight - 120);
    const width = Math.min(availableWidth, availableHeight * ratio);

    caseHero.style.setProperty("--case-ratio", String(ratio));
    caseHero.style.width = `${Math.round(width)}px`;
  }

  function renderInformation(project) {
    const summary = project.summary?.trim() || "";
    const services = Array.isArray(project.services) ? project.services : [];
    const credits = Array.isArray(project.credits) ? project.credits : [];

    caseStudySummary.textContent = summary;
    caseStudySummary.hidden = !summary;
    caseServices.replaceChildren();
    services.forEach((service) => {
      const item = document.createElement("li");
      item.textContent = service;
      caseServices.append(item);
    });
    caseServicesSection.hidden = services.length === 0;
    caseCredits.replaceChildren();
    credits.forEach((credit) => {
      const role = document.createElement("dt");
      const name = document.createElement("dd");
      role.textContent = credit.role;
      name.textContent = credit.name;
      caseCredits.append(role, name);
    });
    caseCreditsSection.hidden = credits.length === 0;
    caseStudyInformation.hidden = !summary && services.length === 0 && credits.length === 0;
  }

  function createMediaFigure(media) {
    const figure = document.createElement("figure");
    figure.className = "case-study-media";

    if (media.type === "image") {
      const image = document.createElement("img");
      image.src = mediaSource(media);
      image.alt = media.alt;
      image.loading = "lazy";
      image.decoding = "async";
      figure.append(image);
    } else if (media.type === "embed") {
      const iframe = document.createElement("iframe");
      const frame = document.createElement("div");
      const toggle = document.createElement("button");
      figure.classList.add("case-study-media--interactive");
      frame.className = "case-study-interactive-frame";
      iframe.src = media.src;
      iframe.title = media.title;
      iframe.loading = "lazy";
      iframe.allow = "camera; fullscreen; clipboard-write";
      iframe.referrerPolicy = "same-origin";
      iframe.tabIndex = -1;
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-downloads allow-forms allow-modals allow-pointer-lock"
      );
      iframe.setAttribute("allowfullscreen", "");
      iframe.style.aspectRatio = String(ratioValue(media.aspectRatio));
      toggle.className = "case-study-interactive-toggle";
      toggle.type = "button";

      const setInteractive = (active) => {
        frame.classList.toggle("is-interactive", active);
        toggle.textContent = active ? "Back to scrolling" : "Interact";
        toggle.setAttribute("aria-pressed", String(active));
        toggle.setAttribute(
          "aria-label",
          active ? "Return to case study scrolling" : `Interact with ${media.title}`
        );
        iframe.tabIndex = active ? 0 : -1;

        if (active) {
          requestAnimationFrame(() => iframe.focus({ preventScroll: true }));
        }
      };

      toggle.addEventListener("click", () => {
        setInteractive(!frame.classList.contains("is-interactive"));
      });
      iframe.addEventListener("load", () => {
        try {
          iframe.contentWindow.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setInteractive(false);
              toggle.focus({ preventScroll: true });
            }
          });
        } catch {
          // The visible toggle remains available if iframe access is restricted.
        }
      });
      setInteractive(false);
      frame.append(iframe, toggle);
      figure.append(frame);
    } else {
      const video = document.createElement("video");
      const toggle = document.createElement("button");
      video.src = mediaSource(media);
      video.poster = media.poster || "";
      video.loop = media.loop !== false;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", media.alt);
      video.style.aspectRatio = String(ratioValue(media.aspectRatio));
      toggle.className = "case-video-toggle";
      toggle.type = "button";
      bindVideoControl(video, toggle);
      figure.append(video, toggle);
    }

    if (media.caption?.trim()) {
      const caption = document.createElement("figcaption");
      caption.textContent = media.caption.trim();
      figure.append(caption);
    }

    return figure;
  }

  function renderGallery(project) {
    caseGallery.replaceChildren();
    const media = Array.isArray(project.media) ? project.media : [];
    media.forEach((item) => caseGallery.append(createMediaFigure(item)));
    caseGallery.hidden = media.length === 0;
  }

  function setAccordionExpanded(item, expanded) {
    if (!item) {
      return;
    }

    const trigger = item.querySelector("[data-case-project]");
    const panel = item.querySelector(".case-study-accordion-panel");
    const panelInner = item.querySelector(".case-study-accordion-inner");
    item.classList.toggle("is-expanded", expanded);
    trigger?.setAttribute("aria-expanded", String(expanded));
    panel?.setAttribute("aria-hidden", String(!expanded));

    if (panelInner) {
      panelInner.inert = !expanded;
    }
  }

  function projectItemForSlug(slug) {
    return Array.from(caseProjectList.children).find(
      (item) => item.querySelector("[data-case-project]")?.dataset.caseProject === slug
    ) || null;
  }

  function setCurrentAccordionItem(item) {
    caseProjectList.querySelectorAll(".case-study-project-item").forEach((candidate) => {
      const current = candidate === item;
      const trigger = candidate.querySelector("[data-case-project]");
      candidate.classList.toggle("is-current", current);

      if (current) {
        trigger?.setAttribute("aria-current", "page");
      } else {
        trigger?.removeAttribute("aria-current");
      }
    });
  }

  function cancelScrollAnimation() {
    if (scrollAnimationFrame) {
      window.cancelAnimationFrame(scrollAnimationFrame);
      scrollAnimationFrame = 0;
    }
  }

  function animateCaseScroll(target, duration = caseScrollDuration) {
    cancelScrollAnimation();
    const maximum = Math.max(
      0,
      caseStudyScroll.scrollHeight - caseStudyScroll.clientHeight
    );
    const end = Math.min(maximum, Math.max(0, target));
    const start = caseStudyScroll.scrollTop;
    const distance = end - start;

    if (reduceCaseMotion || duration <= 0 || Math.abs(distance) < 1) {
      caseStudyScroll.scrollTop = end;
      return;
    }

    const startedAt = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      caseStudyScroll.scrollTop = start + distance * eased;

      if (progress < 1) {
        scrollAnimationFrame = window.requestAnimationFrame(step);
      } else {
        scrollAnimationFrame = 0;
      }
    };

    scrollAnimationFrame = window.requestAnimationFrame(step);
  }

  function revealAccordionItem(item, animated = true) {
    if (!item) {
      return;
    }

    const scrollBounds = caseStudyScroll.getBoundingClientRect();
    const anchor = item.querySelector("[data-case-project]") || item;
    const itemBounds = anchor.getBoundingClientRect();
    const inset = 8;
    let target = caseStudyScroll.scrollTop;

    if (itemBounds.top < scrollBounds.top + inset) {
      target += itemBounds.top - scrollBounds.top - inset;
    } else if (itemBounds.bottom > scrollBounds.bottom - inset) {
      target += itemBounds.bottom - scrollBounds.bottom + inset;
    } else {
      return;
    }

    if (animated) {
      animateCaseScroll(target);
    } else {
      cancelScrollAnimation();
      caseStudyScroll.scrollTop = Math.max(0, target);
    }
  }

  function hslToRgb(hue, saturation, lightness) {
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

  function hoverTextColor(hue, saturation, lightness) {
    const luminance = hslToRgb(hue, saturation, lightness)
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

  function setProjectHoverColor(trigger) {
    hoverHue = (hoverHue + 137.508 + (Math.random() - 0.5) * 18) % 360;
    const previousHue = Number(trigger.dataset.caseHoverHue);

    if (Number.isFinite(previousHue)) {
      const distance = Math.abs(((hoverHue - previousHue + 540) % 360) - 180);

      if (distance < 54) {
        hoverHue = (hoverHue + 96) % 360;
      }
    }

    const saturation = 78 + Math.random() * 12;
    const lightness = 54 + Math.random() * 14;
    trigger.dataset.caseHoverHue = hoverHue.toFixed(1);
    trigger.style.setProperty(
      "--case-hover-color",
      `hsl(${hoverHue.toFixed(1)}deg ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`
    );
    trigger.style.setProperty(
      "--case-hover-text",
      hoverTextColor(hoverHue, saturation, lightness)
    );
  }

  function shuffleProjectHoverColors() {
    hoverHue = Math.random() * 360;
    caseProjectList
      .querySelectorAll("[data-case-project]")
      .forEach(setProjectHoverColor);
  }

  function buildProjectList() {
    if (caseProjectList.children.length > 0) {
      return;
    }

    const fragment = document.createDocumentFragment();

    projects.forEach((project) => {
      const item = document.createElement("li");
      const trigger = document.createElement("button");
      const number = document.createElement("span");
      const title = document.createElement("span");
      const tags = document.createElement("span");
      const panel = document.createElement("div");
      const panelInner = document.createElement("div");
      const triggerId = `case-study-trigger-${project.slug}`;
      const panelId = `case-study-panel-${project.slug}`;
      item.className = "case-study-project-item";
      trigger.className = "case-study-project-link";
      trigger.type = "button";
      trigger.id = triggerId;
      trigger.dataset.caseProject = project.slug;
      trigger.setAttribute("aria-controls", panelId);
      trigger.setAttribute("aria-expanded", "false");
      number.className = "case-study-project-number";
      number.textContent = formatProjectNumber(project.order);
      title.className = "case-study-project-title";
      title.textContent = project.title;
      tags.className = "case-study-project-tags";
      const projectTags = project.tags || [];
      tags.setAttribute("aria-label", `Tags: ${projectTags.join(", ")}`);
      projectTags.forEach((tag) => {
        const pill = document.createElement("span");
        const pillLabel = document.createElement("span");
        pill.className = "case-study-project-tag";
        pillLabel.className = "case-study-project-tag-label";
        pillLabel.textContent = tag;
        pill.append(pillLabel);
        tags.append(pill);
      });
      tags.hidden = tags.children.length === 0;
      panel.className = "case-study-accordion-panel";
      panel.id = panelId;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", triggerId);
      panel.setAttribute("aria-hidden", "true");
      panelInner.className = "case-study-accordion-inner";
      panelInner.inert = true;
      panel.append(panelInner);

      trigger.addEventListener("pointerenter", () => {
        setProjectHoverColor(trigger);
      });
      trigger.addEventListener("focus", () => {
        if (!trigger.matches(":hover")) {
          setProjectHoverColor(trigger);
        }
      });
      trigger.append(number, title, tags);
      item.append(trigger, panel);
      fragment.append(item);
    });

    caseProjectList.replaceChildren(fragment);
    shuffleProjectHoverColors();
  }

  function setHeroTime(video, time) {
    if (!Number.isFinite(time) || time <= 0) {
      return;
    }

    const applyTime = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      try {
        video.currentTime = time % video.duration;
      } catch {
        // Some browsers reject seeks until the first frame is available.
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applyTime();
    } else {
      video.addEventListener("loadedmetadata", applyTime, { once: true });
    }
  }

  function renderProject(
    project,
    { currentTime = 0, expanded = true } = {}
  ) {
    activeProject = project;
    activeSlug = project.slug;
    const number = formatProjectNumber(project.order);
    caseHeadingNumber.textContent = number;
    caseStudyTitle.textContent = project.title;
    caseHeroVideo.pause();
    caseHeroVideo.src = mediaSource(project.hero);
    caseHeroVideo.poster = project.hero.poster || "";
    caseHeroVideo.loop = project.hero.loop !== false;
    caseHeroVideo.muted = true;
    caseHeroVideo.defaultMuted = true;
    caseHeroVideo.volume = 0;
    caseHeroVideo.setAttribute("aria-label", project.hero.alt);
    caseHeroVideo.dataset.userPaused = "false";
    setHeroTime(caseHeroVideo, currentTime);
    renderInformation(project);
    renderGallery(project);
    const activeItem = projectItemForSlug(project.slug);
    const panelInner = activeItem?.querySelector(".case-study-accordion-inner");
    panelInner?.append(caseStudyContent);
    setCurrentAccordionItem(activeItem);
    caseProjectList
      .querySelectorAll(".case-study-project-item.is-expanded")
      .forEach((item) => {
        if (item !== activeItem) {
          setAccordionExpanded(item, false);
        }
      });
    setAccordionExpanded(activeItem, expanded);
    caseStudyDialog.removeAttribute("aria-labelledby");
    caseStudyDialog.setAttribute("aria-label", `${project.title} case study`);
    updateMetadata(project);
    sizeHero();
    setupVideoObserver();

    return activeItem;
  }

  buildProjectList();
  bindVideoControl(caseHeroVideo, caseHeroToggle);

  function transformRectToBase(rect, base) {
    const translateX = rect.left - base.left;
    const translateY = rect.top - base.top;
    const scaleX = rect.width / base.width;
    const scaleY = rect.height / base.height;

    return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
  }

  async function animateThumbnailIntoHero(origin) {
    if (
      reduceCaseMotion ||
      !origin?.frame ||
      !origin?.video ||
      !origin.video.currentSrc
    ) {
      caseStudyLayer.classList.remove("is-ghosting");
      syncVideoPlayback(caseHeroVideo);
      return;
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const start = origin.frame.getBoundingClientRect();
    const end = caseHero.getBoundingClientRect();

    if (start.width < 1 || start.height < 1 || end.width < 1 || end.height < 1) {
      caseStudyLayer.classList.remove("is-ghosting");
      syncVideoPlayback(caseHeroVideo);
      return;
    }

    const ghost = document.createElement("div");
    const video = document.createElement("video");
    ghost.className = "case-study-transition-ghost";
    Object.assign(ghost.style, {
      left: `${end.left}px`,
      top: `${end.top}px`,
      width: `${end.width}px`,
      height: `${end.height}px`,
      transformOrigin: "top left",
    });
    video.src = origin.video.currentSrc;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    setHeroTime(video, origin.currentTime || origin.video.currentTime || 0);
    ghost.append(video);
    document.body.append(ghost);
    video.play().catch(() => {});

    const animation = ghost.animate(
      [
        {
          transform: transformRectToBase(start, end),
          borderRadius: "0px",
        },
        {
          transform: "translate3d(0, 0, 0) scale(1, 1)",
          borderRadius: "12px",
        },
      ],
      {
        duration: compactCaseMedia.matches ? 620 : 820,
        easing: "cubic-bezier(0.19, 1, 0.22, 1)",
        fill: "forwards",
      }
    );
    ghostAnimation = animation;

    try {
      await animation.finished;
    } catch {
      // A new navigation can intentionally cancel the transition.
    }

    if (ghostAnimation !== animation) {
      ghost.remove();
      return;
    }

    ghostAnimation = null;
    caseStudyLayer.classList.remove("is-ghosting");
    syncVideoPlayback(caseHeroVideo);
    const handoffDelay = compactCaseMedia.matches ? 140 : 190;
    await new Promise((resolve) => window.setTimeout(resolve, handoffDelay));
    ghost.remove();
  }

  function animateHeroIntoThumbnail() {
    const frame = document.querySelector("[data-video-frame]");
    const accordionPanel = caseHero.closest(".case-study-accordion-panel");

    if (
      reduceCaseMotion ||
      !frame ||
      !caseHeroVideo.currentSrc ||
      !activeProject ||
      accordionPanel?.getAttribute("aria-hidden") === "true"
    ) {
      return null;
    }

    const start = caseHero.getBoundingClientRect();
    const end = frame.getBoundingClientRect();

    if (
      start.width < 1 ||
      start.height < 1 ||
      end.width < 1 ||
      end.height < 1 ||
      start.bottom < 0 ||
      start.top > window.innerHeight
    ) {
      return null;
    }

    const ghost = document.createElement("div");
    const video = document.createElement("video");
    ghost.className = "case-study-transition-ghost";
    Object.assign(ghost.style, {
      left: `${start.left}px`,
      top: `${start.top}px`,
      width: `${start.width}px`,
      height: `${start.height}px`,
      borderRadius: "12px",
      transformOrigin: "top left",
    });
    video.src = caseHeroVideo.currentSrc;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    setHeroTime(video, caseHeroVideo.currentTime || 0);
    ghost.append(video);
    document.body.append(ghost);
    video.play().catch(() => {});
    caseStudyLayer.classList.add("is-ghosting");
    const animation = ghost.animate(
      [
        {
          transform: "translate3d(0, 0, 0) scale(1, 1)",
          borderRadius: "12px",
        },
        {
          transform: transformRectToBase(end, start),
          borderRadius: "0px",
        },
      ],
      {
        duration: compactCaseMedia.matches ? 520 : 720,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "forwards",
      }
    );

    animation.finished
      .catch(() => {})
      .finally(() => window.setTimeout(() => ghost.remove(), 110));

    return animation;
  }

  function prepareLayer({ origin = null } = {}) {
    isOpen = true;
    lastFocusedElement = document.activeElement;
    cancelScrollAnimation();
    caseStudyScroll.scrollTop = 0;
    shuffleProjectHoverColors();
    caseStudyLayer.hidden = false;
    caseStudyLayer.classList.remove("is-closing");
    caseStudyLayer.setAttribute("aria-hidden", "false");
    caseStudyLayer.classList.toggle("is-ghosting", Boolean(origin) && !reduceCaseMotion);
    caseStudyDialog.setAttribute("aria-busy", "true");
    setBackgroundInert(true);
    window.dispatchEvent(new CustomEvent("kozi:casestudystate", {
      detail: { open: true },
    }));
  }

  function revealPreparedLayer() {
    requestAnimationFrame(() => {
      if (isOpen) {
        caseStudyLayer.classList.add("is-open");
      }
    });
  }

  function waitForCaseMotion(duration) {
    if (reduceCaseMotion) {
      return Promise.resolve();
    }

    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  function nextCaseFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function transitionToProject(project, { currentTime = 0, token } = {}) {
    const previousItem = projectItemForSlug(activeSlug);
    const targetItem = projectItemForSlug(project.slug);

    if (!previousItem || !targetItem || previousItem === targetItem) {
      return renderProject(project, { currentTime });
    }

    const previousPanel = previousItem.querySelector(".case-study-accordion-panel");
    const collapseDistance = previousPanel?.getBoundingClientRect().height || 0;
    const previousExpanded = previousItem.classList.contains("is-expanded");
    const longCollapseThreshold = compactCaseMedia.matches
      ? Math.max(560, caseStudyScroll.clientHeight * 0.9)
      : Math.max(1200, caseStudyScroll.clientHeight * 1.35);
    const snapLongCollapse =
      previousExpanded &&
      collapseDistance > longCollapseThreshold;
    const collapseDuration = previousExpanded && !snapLongCollapse
      ? accordionCollapseDuration
      : 0;
    const targetFollowsPrevious = Boolean(
      previousItem.compareDocumentPosition(targetItem) &
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    const targetTrigger = targetItem.querySelector("[data-case-project]");
    const targetTopBefore = targetTrigger?.getBoundingClientRect().top;

    pauseAllCaseVideos();
    setCurrentAccordionItem(targetItem);

    if (snapLongCollapse) {
      previousItem.classList.add("is-snap-collapsing");
      cancelScrollAnimation();
    }

    setAccordionExpanded(previousItem, false);

    if (
      snapLongCollapse &&
      targetFollowsPrevious &&
      Number.isFinite(targetTopBefore)
    ) {
      const targetTopAfter = targetTrigger.getBoundingClientRect().top;
      caseStudyScroll.scrollTop = Math.max(
        0,
        caseStudyScroll.scrollTop + targetTopAfter - targetTopBefore
      );
      previousItem.classList.remove("is-snap-collapsing");
    } else if (
      targetFollowsPrevious &&
      collapseDistance > 0 &&
      collapseDuration > 0
    ) {
      animateCaseScroll(
        caseStudyScroll.scrollTop - collapseDistance,
        collapseDuration
      );
    }

    if (snapLongCollapse) {
      await nextCaseFrame();
      previousItem.classList.remove("is-snap-collapsing");
    } else {
      await waitForCaseMotion(collapseDuration);
    }

    if (token !== loadToken || !isOpen) {
      return null;
    }

    const activeItem = renderProject(project, {
      currentTime,
      expanded: reduceCaseMotion,
    });

    if (!reduceCaseMotion) {
      await nextCaseFrame();

      if (token !== loadToken || !isOpen) {
        return null;
      }

      setAccordionExpanded(activeItem, true);
      revealAccordionItem(activeItem, true);
      await waitForCaseMotion(accordionExpandDuration);
    }

    requestAnimationFrame(() => {
      caseStudyDialog.querySelectorAll("video").forEach(syncVideoPlayback);
    });
    return activeItem;
  }

  function finishProjectSwitch() {
    isProjectSwitching = false;
    caseStudyLayer.classList.remove("is-switching");
    caseStudyDialog.removeAttribute("aria-busy");

    const queued = queuedProjectRequest;
    queuedProjectRequest = null;

    if (queued && isOpen && queued.slug !== activeSlug) {
      queueMicrotask(() => openProject(queued.slug, queued.options));
    }
  }

  function commitProjectHistory(summary, slug, historyMode) {
    const state = {
      koziView: "case",
      slug,
      depth: caseHistoryDepth,
      fromHomepage: openedFromHomepage,
    };

    if (historyMode === "push") {
      caseHistoryDepth += 1;
      state.depth = caseHistoryDepth;
      history.pushState(state, "", summary.route);
    } else if (historyMode === "replace") {
      history.replaceState(state, "", summary.route);
    }
  }

  async function openProject(
    slug,
    {
      origin = null,
      currentTime = 0,
      historyMode = "push",
      direct = false,
    } = {}
  ) {
    const summary = projectForSlug(slug);

    if (!summary) {
      return;
    }

    if (isProjectSwitching) {
      queuedProjectRequest = {
        slug,
        options: { origin, currentTime, historyMode, direct },
      };
      return;
    }

    if (isOpen && activeSlug === slug) {
      return;
    }

    const token = ++loadToken;
    const replacingProject = Boolean(isOpen && activeSlug && activeSlug !== slug);

    if (replacingProject) {
      isProjectSwitching = true;
      caseStudyLayer.classList.add("is-switching");
      caseStudyDialog.setAttribute("aria-busy", "true");
    }

    let project;

    try {
      project = await loadProject(slug);
    } catch (error) {
      if (token !== loadToken) {
        return;
      }

      console.error(error);

      if (replacingProject) {
        finishProjectSwitch();
      }

      caseStatus.textContent = "This case study could not be loaded.";
      return;
    }

    if (token !== loadToken) {
      return;
    }

    if (!replacingProject) {
      prepareLayer({ origin });
    }

    const activeItem = replacingProject
      ? await transitionToProject(project, { currentTime, token })
      : renderProject(project, { currentTime });

    if (token !== loadToken || !activeItem) {
      return;
    }

    commitProjectHistory(summary, slug, historyMode);
    caseStudyDialog.removeAttribute("aria-busy");

    if (!replacingProject) {
      revealPreparedLayer();
    }

    window.dispatchEvent(new CustomEvent("kozi:requeststageproject", {
      detail: { slug },
    }));
    caseStatus.textContent = `${project.title} case study opened.`;

    if (origin) {
      await animateThumbnailIntoHero({ ...origin, currentTime });
    } else {
      caseStudyLayer.classList.remove("is-ghosting");
    }

    if (replacingProject) {
      finishProjectSwitch();
    } else if (direct || !origin) {
      caseStudyClose.focus({ preventScroll: true });
    } else {
      window.setTimeout(() => caseStudyClose.focus({ preventScroll: true }), 40);
    }
  }

  function finishClose({ restoreFocus = true } = {}) {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    ++loadToken;
    isProjectSwitching = false;
    queuedProjectRequest = null;
    cancelScrollAnimation();
    ghostAnimation?.cancel();
    ghostAnimation = null;
    document.querySelector(".case-study-transition-ghost")?.remove();
    const reverseAnimation = animateHeroIntoThumbnail();
    const handoff = {
      slug: activeSlug,
      currentTime: caseHeroVideo.currentTime || 0,
    };
    pauseAllCaseVideos();
    videoObserver?.disconnect();
    visibleVideos.clear();
    caseStudyLayer.classList.add("is-closing");
    caseStudyLayer.classList.remove("is-open", "is-switching");
    caseStudyDialog.removeAttribute("aria-busy");

    if (!reverseAnimation) {
      caseStudyLayer.classList.remove("is-ghosting");
    }
    caseStudyLayer.setAttribute("aria-hidden", "true");
    setBackgroundInert(false);
    updateMetadata();
    window.dispatchEvent(new CustomEvent("kozi:casestudystate", {
      detail: {
        open: false,
        closing: Boolean(reverseAnimation),
        ...handoff,
      },
    }));

    if (reverseAnimation) {
      reverseAnimation.finished
        .catch(() => {})
        .finally(() => {
          window.dispatchEvent(new CustomEvent("kozi:casestudystate", {
            detail: { open: false, closing: false, ...handoff },
          }));
        });
    }

    const finalize = () => {
      if (isOpen) {
        return;
      }

      caseStudyLayer.hidden = true;
      caseStudyLayer.classList.remove("is-closing", "is-ghosting");
      activeSlug = null;
      activeProject = null;

      if (restoreFocus && lastFocusedElement?.isConnected) {
        lastFocusedElement.focus({ preventScroll: true });
      }

      caseStatus.textContent = "Case study closed.";
    };

    if (reduceCaseMotion) {
      finalize();
    } else {
      window.setTimeout(finalize, 760);
    }
  }

  function closeProject() {
    if (!isOpen) {
      return;
    }

    if (openedFromHomepage && caseHistoryDepth > 0) {
      closeAfterHistoryChange = true;
      history.go(-caseHistoryDepth);
      return;
    }

    history.replaceState({ koziView: "home" }, "", "/");
    caseHistoryDepth = 0;
    finishClose();
  }

  caseStudyClose.addEventListener("click", closeProject);
  caseStudyBackdrop.addEventListener("click", closeProject);

  caseProjectList.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-case-project]");

    if (!trigger) {
      return;
    }

    event.preventDefault();
    const item = trigger.closest(".case-study-project-item");
    const slug = trigger.dataset.caseProject;

    if (isProjectSwitching) {
      openProject(slug, { historyMode: "push" });
      return;
    }

    if (slug === activeSlug) {
      const expanding = trigger.getAttribute("aria-expanded") !== "true";
      setAccordionExpanded(item, expanding);

      if (expanding) {
        revealAccordionItem(item, !reduceCaseMotion);
        requestAnimationFrame(() => {
          caseStudyDialog.querySelectorAll("video").forEach(syncVideoPlayback);
        });
      } else {
        pauseAllCaseVideos();
      }

      return;
    }

    openProject(slug, { historyMode: "push" });
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeProject();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      caseStudyDialog.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hidden && element.offsetParent !== null);

    if (focusable.length === 0) {
      event.preventDefault();
      caseStudyDialog.focus();
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

  window.addEventListener("kozi:requestprojectopen", (event) => {
    const slug = event.detail?.slug;

    if (!projectForSlug(slug)) {
      return;
    }

    openedFromHomepage = true;
    caseHistoryDepth = 0;
    openProject(slug, {
      origin: event.detail,
      currentTime: event.detail.currentTime,
      historyMode: "push",
    });
  });

  window.addEventListener("kozi:projectchange", (event) => {
    prefetchProjectData(event.detail?.project?.slug || event.detail?.slug);
  });

  window.addEventListener("popstate", (event) => {
    const slug = slugFromLocation();

    if (closeAfterHistoryChange) {
      closeAfterHistoryChange = false;
      caseHistoryDepth = 0;
      finishClose();
      return;
    }

    if (!slug) {
      caseHistoryDepth = 0;
      finishClose();
      return;
    }

    const state = event.state || {};
    caseHistoryDepth = Number(state.depth) || 0;
    openedFromHomepage = Boolean(state.fromHomepage);
    openProject(slug, { historyMode: "none", direct: !isOpen });
  });

  document.addEventListener("visibilitychange", () => {
    caseStudyDialog.querySelectorAll("video").forEach(syncVideoPlayback);
  });

  window.addEventListener("resize", sizeHero);

  const initialSlug = document.body.dataset.initialProject || slugFromLocation();

  if (initialSlug && projectForSlug(initialSlug)) {
    openedFromHomepage = false;
    caseHistoryDepth = 0;
    history.replaceState(
      {
        koziView: "case",
        slug: initialSlug,
        depth: 0,
        fromHomepage: false,
      },
      "",
      projectForSlug(initialSlug).route
    );
    await openProject(initialSlug, {
      historyMode: "none",
      direct: true,
    });
  } else {
    history.replaceState({ koziView: "home" }, "", window.location.pathname);
  }

  prefetchProjectData(document.querySelector("#work")?.dataset.projectSlug);
  scheduleProjectDataPrefetch();
}
