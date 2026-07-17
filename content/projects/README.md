# Case-study content

Each directory contains one `project.json`; its directory name and `slug` must match. Run `npm run check:projects` after editing content and `npm run build` to regenerate the homepage project index and the shareable `/work/<slug>/` entry pages.

## Fields

- `order`, `slug`, and `title` control the homepage and project-list order.
- `summary` is the single introductory paragraph. Leave it empty to hide the paragraph.
- `tags` is an optional list of short labels shown as pills in the accordion, such as `3D`, `Motion`, `AI`, and `Tool`.
- `services` is an ordered list such as `Concept`, `Motion Design`, `Graphic Design`, and `Art Direction`.
- `credits` contains `{ "role": "...", "name": "..." }` objects.
- `hero` supplies the homepage thumbnail and the large case-study video. Always provide optimized desktop and mobile files, concise alt text, and its natural aspect ratio.
- `media` is the ordered sequence after the project information. It accepts images, videos, and interactive embeds. Images and videos need alt text; every item can have an optional caption.

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

All case-study videos are forced to remain muted in the interface.
