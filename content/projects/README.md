# Case-study content

Each directory contains one `project.json`; its directory name and `slug` must match. Run `npm run check:projects` after editing content and `npm run build` to regenerate the homepage project index and the shareable `/work/<slug>/` entry pages.

## Fields

- `order`, `slug`, and `title` control the homepage and project-list order.
- `summary` is the single introductory paragraph. Leave it empty to hide the paragraph.
- `services` is an ordered list such as `Concept`, `Motion Design`, `Graphic Design`, and `Art Direction`.
- `credits` contains `{ "role": "...", "name": "..." }` objects.
- `hero` supplies the homepage thumbnail and the large case-study video. Always provide optimized desktop and mobile files, concise alt text, and its natural aspect ratio.
- `media` is the ordered sequence after the project information. It accepts image and video items, each with alt text and an optional caption.

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
  }
]
```

All case-study videos are forced to remain muted in the interface.
