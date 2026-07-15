document.documentElement.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const favicon = document.querySelector("[data-presence-favicon]");
const videos = Array.from(document.querySelectorAll(".internship-item video"));
const videoFrames = videos.map((video) => {
  const frame = document.createElement("div");

  frame.className = "internship-video-frame";
  video.parentNode.insertBefore(frame, video);
  frame.appendChild(video);
  return frame;
});
const visibleVideos = new Set();
const revealQueue = [];
let revealing = false;

function updateFavicon() {
  if (!favicon) {
    return;
  }

  favicon.href = document.hidden
    ? favicon.dataset.inactiveHref
    : favicon.dataset.activeHref;
}

function prepareVideo(video) {
  if (video.dataset.prepared === "true") {
    return;
  }

  const source = video.querySelector("source[data-src]");

  if (!source) {
    return;
  }

  source.src = source.dataset.src;
  source.removeAttribute("data-src");
  video.dataset.prepared = "true";
  video.load();
}

function playVideo(video) {
  prepareVideo(video);

  if (reduceMotion || document.hidden) {
    return;
  }

  video.play().catch(() => {});
}

function pauseVideo(video) {
  video.pause();
}

function waitForVideo(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish() {
      if (settled) {
        return;
      }

      settled = true;
      video.removeEventListener("loadedmetadata", finish);
      resolve();
    }

    video.addEventListener("loadedmetadata", finish, { once: true });
    window.setTimeout(finish, 1400);
  });
}

async function revealNextVideo() {
  if (revealing || revealQueue.length === 0) {
    return;
  }

  revealing = true;
  const video = revealQueue.shift();
  const item = video.closest(".internship-item");

  prepareVideo(video);
  await waitForVideo(video);
  video.classList.add("is-loaded");

  requestAnimationFrame(() => {
    item?.classList.add("is-revealed");
  });

  window.setTimeout(() => {
    revealing = false;
    revealNextVideo();
  }, reduceMotion ? 0 : 240);
}

function queueVideoReveal(video) {
  const item = video.closest(".internship-item");

  if (!item || item.classList.contains("is-revealed") || video.dataset.revealQueued === "true") {
    return;
  }

  video.dataset.revealQueued = "true";
  revealQueue.push(video);
  revealNextVideo();
}

videos.forEach((video) => {
  video.addEventListener("loadedmetadata", () => {
    video.classList.add("is-loaded");
  }, { once: true });

  if (reduceMotion) {
    video.controls = true;
    video.preload = "metadata";
  }
});

if ("IntersectionObserver" in window) {
  const loadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const video = entry.target.querySelector("video");

      prepareVideo(video);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "100% 0px" });

  const playbackObserver = new IntersectionObserver((entries) => {
    entries
      .sort((first, second) => videoFrames.indexOf(first.target) - videoFrames.indexOf(second.target))
      .forEach((entry) => {
        const video = entry.target.querySelector("video");

        if (entry.isIntersecting) {
          visibleVideos.add(video);
          playVideo(video);
          queueVideoReveal(video);
        } else {
          visibleVideos.delete(video);
          pauseVideo(video);
        }
      });
  }, { threshold: 0.05 });

  videoFrames.forEach((frame) => {
    loadObserver.observe(frame);
    playbackObserver.observe(frame);
  });
} else {
  videos.forEach((video) => {
    prepareVideo(video);
    visibleVideos.add(video);
    playVideo(video);
    queueVideoReveal(video);
  });
}

document.addEventListener("visibilitychange", () => {
  updateFavicon();

  visibleVideos.forEach((video) => {
    if (document.hidden) {
      pauseVideo(video);
    } else {
      playVideo(video);
    }
  });
});

updateFavicon();
