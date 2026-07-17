# Case-study content

Each directory contains one `project.json`; its directory name and `slug` must match. Run `npm run check:projects` after editing content and `npm run build` to regenerate the homepage project index and the shareable `/work/<slug>/` entry pages.

## Fields

- `order`, `slug`, and `title` control the homepage and project-list order.
- `wip` adds the blinking work-in-progress pill. Set it to `false` when the case is ready.
- `summary` is the single introductory paragraph. Leave it empty to hide the paragraph.
- `glossary` optionally turns matching summary terms into accessible hover, focus, and tap explanations using `{ "term": "...", "definition": "..." }` objects.
- `tags` is an optional list of short labels shown as pills in the accordion, such as `3D`, `Motion`, `AI`, and `Tool`.
- `services` is an ordered list such as `Concept`, `Motion Design`, `Graphic Design`, and `Art Direction`.
- `credits` contains `{ "name": "..." }` objects and accepts optional `role` and external `href` values.
- `hero` supplies the homepage thumbnail and the large case-study video. Always provide optimized desktop and mobile files, concise alt text, and its natural aspect ratio.
- `caseStudySlug` optionally points a homepage thumbnail to another canonical project, keeping the thumbnail while combining its case-study content.
- `media` is the ordered sequence after the project information. It accepts images, videos, and interactive embeds. Images and videos need alt text; every item can have an optional caption and a `showOn` value of `desktop`, `mobile`, or `all`. Captions can use `captionHref` and `captionShowOn` for responsive external links.

Example media items:

```json
[
  {
    "type": "image",
    "src": "/assets/projects/project-slug/image-01.webp",
    "alt": "Description of the image",
    "caption": "Optional caption"
  },
  {
    "type": "video",
    "desktopSrc": "/assets/projects/project-slug/detail-01-1440.mp4",
    "mobileSrc": "/assets/projects/project-slug/detail-01-960.mp4",
    "poster": "/assets/projects/project-slug/detail-01-poster.webp",
    "alt": "Description of the motion sequence",
    "aspectRatio": "16 / 9",
    "caption": "Optional caption"
  },
  {
    "type": "embed",
    "src": "/assets/interactive/project-tool/index.html",
    "title": "Interactive project tool",
    "aspectRatio": "16 / 10",
    "caption": "Optional instruction or caption"
  }
]
```

Case-study videos autoplay silently by default. For a user-controlled film with sound,
set `"autoplay": false`, `"controls": true`, and `"muted": false`; use `"loop": false`
when the film should stop at the end.
