import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsRoot = path.join(root, "content", "projects");
const projectIndexPath = path.join(root, "assets", "projects", "index.json");
const homepagePath = path.join(root, "index.html");
const checkOnly = process.argv.includes("--check");

function fail(message) {
  throw new Error(`[projects] ${message}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localAssetPath(source) {
  if (!source || /^(?:https?:)?\/\//.test(source)) {
    return null;
  }

  return path.join(root, source.replace(/^\//, ""));
}

async function assertAsset(source, context) {
  const assetPath = localAssetPath(source);

  if (!assetPath) {
    return;
  }

  try {
    await access(assetPath);
  } catch {
    fail(`${context} points to a missing asset: ${source}`);
  }
}

function validateProject(project, directoryName) {
  if (project.schemaVersion !== 1) {
    fail(`${directoryName}/project.json must use schemaVersion 1.`);
  }

  if (project.slug !== directoryName) {
    fail(`${directoryName}/project.json slug must match its directory name.`);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) {
    fail(`${project.slug} is not a URL-safe slug.`);
  }

  if (!Number.isInteger(project.order) || project.order < 1) {
    fail(`${project.slug} needs a positive integer order.`);
  }

  if (!project.title?.trim()) {
    fail(`${project.slug} needs a title.`);
  }

  if (project.wip !== undefined && typeof project.wip !== "boolean") {
    fail(`${project.slug} wip must be true or false.`);
  }

  if (!project.hero?.desktopSrc || !project.hero?.mobileSrc || !project.hero?.alt) {
    fail(`${project.slug} needs desktopSrc, mobileSrc, and alt values in hero.`);
  }

  if (!Array.isArray(project.services) || !Array.isArray(project.credits)) {
    fail(`${project.slug} services and credits must be arrays.`);
  }

  if (
    project.tags !== undefined &&
    (!Array.isArray(project.tags) ||
      project.tags.some((tag) => typeof tag !== "string" || !tag.trim()))
  ) {
    fail(`${project.slug} tags must be an array of non-empty strings.`);
  }

  if (
    project.glossary !== undefined &&
    (!Array.isArray(project.glossary) ||
      project.glossary.some(
        (entry) => !entry?.term?.trim() || !entry?.definition?.trim()
      ))
  ) {
    fail(`${project.slug} glossary must contain term and definition values.`);
  }

  if (!Array.isArray(project.media)) {
    fail(`${project.slug} media must be an array.`);
  }

  project.credits.forEach((credit, index) => {
    if (!credit?.role || !credit?.name) {
      fail(`${project.slug} credit ${index + 1} needs role and name.`);
    }
  });

  project.media.forEach((item, index) => {
    if (!["image", "video", "embed"].includes(item?.type)) {
      fail(`${project.slug} media ${index + 1} must be an image, video, or embed.`);
    }

    if (["image", "video"].includes(item.type) && !item.alt) {
      fail(`${project.slug} media ${index + 1} needs alt text.`);
    }

    if (item.type === "image" && !item.src) {
      fail(`${project.slug} image ${index + 1} needs src.`);
    }

    if (item.type === "video" && (!item.desktopSrc || !item.mobileSrc)) {
      fail(`${project.slug} video ${index + 1} needs desktopSrc and mobileSrc.`);
    }

    if (item.type === "embed" && (!item.src || !item.title)) {
      fail(`${project.slug} embed ${index + 1} needs src and title.`);
    }
  });
}

async function loadProjects() {
  const entries = await readdir(projectsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const projects = [];

  for (const directoryName of directories) {
    const sourcePath = path.join(projectsRoot, directoryName, "project.json");
    let project;

    try {
      project = JSON.parse(await readFile(sourcePath, "utf8"));
    } catch (error) {
      fail(`Unable to read ${directoryName}/project.json: ${error.message}`);
    }

    validateProject(project, directoryName);
    await assertAsset(project.hero.desktopSrc, `${project.slug} hero.desktopSrc`);
    await assertAsset(project.hero.mobileSrc, `${project.slug} hero.mobileSrc`);

    if (project.hero.poster) {
      await assertAsset(project.hero.poster, `${project.slug} hero.poster`);
    }

    for (const [index, item] of project.media.entries()) {
      if (item.type === "image" || item.type === "embed") {
        await assertAsset(item.src, `${project.slug} media ${index + 1}`);
      } else {
        await assertAsset(item.desktopSrc, `${project.slug} media ${index + 1}`);
        await assertAsset(item.mobileSrc, `${project.slug} media ${index + 1}`);
      }

      if (item.poster) {
        await assertAsset(item.poster, `${project.slug} media ${index + 1} poster`);
      }
    }

    projects.push(project);
  }

  const slugs = new Set();
  const orders = new Set();

  projects.forEach((project) => {
    if (slugs.has(project.slug)) {
      fail(`Duplicate slug: ${project.slug}`);
    }

    if (orders.has(project.order)) {
      fail(`Duplicate project order: ${project.order}`);
    }

    slugs.add(project.slug);
    orders.add(project.order);
  });

  return projects.sort((first, second) => first.order - second.order);
}

function projectSummary(project) {
  return {
    order: project.order,
    slug: project.slug,
    title: project.title,
    wip: project.wip === true,
    tags: project.tags || [],
    alt: project.hero.alt,
    aspectRatio: project.hero.aspectRatio || "16 / 9",
    desktopPath: project.hero.desktopSrc,
    mobilePath: project.hero.mobileSrc,
    poster: project.hero.poster || "",
    detailPath: `/content/projects/${project.slug}/project.json?v=3`,
    route: `/work/${project.slug}/`,
  };
}

function createProjectPage(homepage, project) {
  const title = `${escapeHtml(project.title)} | KOZI Studio`;
  const description = project.summary?.trim()
    ? escapeHtml(project.summary.trim())
    : `Case study: ${escapeHtml(project.title)} by Albert Kozikowski.`;
  const route = `https://www.kozi.studio/work/${project.slug}/`;
  let page = homepage;

  page = page.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  page = page.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*>/s,
    `<meta name="description" content="${description}">`
  );
  page = page.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*>/s,
    '<meta name="robots" content="noindex, follow, max-image-preview:large">'
  );
  page = page.replace(
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${route}">`
  );
  page = page.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${title}">`
  );
  page = page.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*>/s,
    `<meta property="og:description" content="${description}">`
  );
  page = page.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${route}">`
  );
  page = page.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${title}">`
  );
  page = page.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*>/s,
    `<meta name="twitter:description" content="${description}">`
  );
  page = page.replace(
    '<body id="top">',
    `<body id="top" data-initial-project="${escapeHtml(project.slug)}">`
  );

  return `<!-- Generated by scripts/build-project-pages.mjs. -->\n${page}`;
}

async function main() {
  const projects = await loadProjects();

  if (projects.length === 0) {
    fail("No projects found.");
  }

  if (!checkOnly) {
    const homepage = await readFile(homepagePath, "utf8");
    const index = {
      schemaVersion: 1,
      projects: projects.map(projectSummary),
    };

    await mkdir(path.dirname(projectIndexPath), { recursive: true });
    await writeFile(projectIndexPath, `${JSON.stringify(index, null, 2)}\n`);

    for (const project of projects) {
      const routeDirectory = path.join(root, "work", project.slug);
      await mkdir(routeDirectory, { recursive: true });
      await writeFile(
        path.join(routeDirectory, "index.html"),
        createProjectPage(homepage, project)
      );
    }
  }

  const action = checkOnly ? "Validated" : "Generated";
  console.log(`${action} ${projects.length} project case studies.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
