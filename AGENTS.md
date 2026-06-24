# AGENTS.md

## Project

This repository contains a static Astro site for live website template demos.
It deploys to Cloudflare Pages as `design-templates`, currently intended for
the interim domain `ofs-demos.endian.dev`.

## Commands

- `pnpm dev`: run the local Astro development server.
- `pnpm check`: run Astro type checks.
- `pnpm validate:designs`: run lightweight design-demo guard checks.
- `pnpm build`: validate, check, and create the static `dist/` build.
- `pnpm preview`: preview the built site locally.
- `pnpm test:e2e`: run Playwright smoke tests against the preview server.

Run `pnpm check`, `pnpm build`, and `pnpm test:e2e` before considering
infrastructure or demo changes complete.

## Toolchain

- Node is pinned in `.node-version`.
- pnpm is pinned through `packageManager` in `package.json`.
- Use Corepack to activate pnpm.
- pnpm dependency build-script approvals live in `pnpm-workspace.yaml`.
- Do not commit generated output such as `dist/`, `.astro/`, `.wrangler/`, or
  test artifacts.

## Deployment

The production Cloudflare Pages project uses:

- Project: `design-templates`
- Production branch: `main`
- Root directory: repository root
- Build command:
  `corepack enable && corepack prepare pnpm@11.5.0 --activate && pnpm install --frozen-lockfile && pnpm build`
- Output directory: `dist`

Pages response headers live in `public/_headers`. The landing page (`/`) is
indexable so fraternities can discover the site through search. The design
demos (`/designs/*`) and the preview viewer (`/preview`) are kept out of
search via `X-Robots-Tag` / `meta robots` (noindex). Keep that split unless
the project owner explicitly changes the decision.

## Boundaries

- Keep this project static-first. Do not add SSR, APIs, or Worker request
  handling unless there is a clear requirement.
- Do not add `wrangler.jsonc` for git-connected Pages deployments.
- Keep design source archives, scratch exports, and generated thumbnails out of
  git unless they are intentional optimized site assets.
- The landing page is public and indexed, but the demo pages should remain
  noindexed template previews. Avoid committing secrets, private contact
  lists, `.env` files, Cloudflare tokens, or private configuration.
