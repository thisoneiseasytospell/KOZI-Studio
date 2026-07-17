# Project media

Add new case-study images, posters, and secondary videos under a directory that matches the project slug:

```text
assets/projects/project-slug/
  hero-1440.mp4
  hero-960.mp4
  hero-poster.webp
  image-01.webp
  detail-01-1440.mp4
  detail-01-960.mp4
```

The initial case studies reference the already optimized files in `assets/videos/optimized` so those videos are not duplicated. New media can use the per-project structure above and be referenced with root-relative paths from `project.json`.

Self-contained interactive pieces live in `assets/interactive/<project-tool>/` and can be added to a case study with an `embed` media item.
