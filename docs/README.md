# Showcase media

Drop the following files here to populate the project page:

- `teaser.png` — hero still on the showcase. Best framing: medium-shot of a character walking on a splat-derived floor, ideally with a clean splat (e.g. Marble Labs diner). 16:9 aspect, ~1600 px wide.
- `teaser.mp4` *(optional)* — short loop (3–6 s) showing the walk cycle. Used in preference to `teaser.png` if both exist.
- `result.png` — second still further down the page. Good options: floor carpet (green wireframe) overlaid on the splat to show the heightmap surface, or a different splat scene to show the pipeline generalises.

Both are referenced relative to the repo root (`./docs/teaser.png`, `./docs/result.png`). The site uses `<picture>`/`<img onerror>` so missing files fall back to a placeholder rather than breaking layout — but for the published showcase you'll want both.
