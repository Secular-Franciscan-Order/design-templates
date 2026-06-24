# Design Templates

Static Astro site for live, interactive design-direction previews.

This repository is the reusable home for review demos. The first production use
is the St. Margaret of Cortona Fraternity redesign preview gallery.

## Local Development

```bash
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

## Verification

```bash
pnpm check
pnpm build
pnpm test:e2e
```

## Cloudflare Pages

- Project: `design-templates`
- Root directory: repository root
- Build command:
  `corepack enable && corepack prepare pnpm@11.5.0 --activate && pnpm install --frozen-lockfile && pnpm build`
- Output directory: `dist`

The site is intentionally unlisted and noindexed. Headers are defined in
`public/_headers`.
