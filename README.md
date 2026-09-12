# Fraternity website designs

A static Astro gallery and persistent preview viewer for five complete website
designs. The public gallery uses the fictional **St. Clare Fraternity in Cedar
Grove** throughout. Its gathering is the second Sunday of each month, 2–4 pm,
at St. Mary Parish Hall. Demo contact details use reserved example addresses
and a fictional phone number. Demo forms never send messages.

The overview contact form is separate: a single Cloudflare Pages Function at
`/api/contact` verifies Turnstile and asks Cloudflare Email Service to deliver
a website inquiry. Every other route remains static.

## Development and verification

Use the Node version in `.node-version` and the pnpm version in `package.json`.

```sh
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Before completion, run:

```sh
pnpm check
pnpm test:contact
pnpm build
pnpm test:e2e
```

`pnpm test:contact` exercises the actual Function handler with deterministic
provider responses. It never sends email or verifies a live token. End-to-end
tests cover full demo routes, local navigation, the persistent bar, responsive
layouts, legacy links, and contact-form success/failure with mocked requests.
CI runs all of these checks.

Astro development mode can reject stylesheet requests from an opaque sandboxed
iframe with `Cross-origin request blocked`. Use `pnpm build` followed by
`pnpm preview` to inspect the complete preview. Do not weaken the iframe sandbox
to work around development middleware. The iframe intentionally omits
`allow-same-origin`, `allow-forms`, and top-level navigation permissions.

Astro's development and preview servers do **not** execute Pages Functions.
To exercise `/api/contact` locally, use Cloudflare's Pages development server
against `dist` with the repository's `functions/` directory. A request without
the required server configuration returns an honest 503 and email fallback.
Use localhost as the request Origin. Do not use a real recipient/provider for
automated tests.

## Contact configuration

The code does not include Cloudflare credentials, a sender, or recipient
configuration. Configure the **Preview** and **Production** environments
separately in the existing Cloudflare Pages project before expecting the form
to send. The visible email fallback remains available during setup.

| Setting | Environment | Purpose |
| --- | --- | --- |
| `PUBLIC_TURNSTILE_SITE_KEY` | Build variable | Public Turnstile site key embedded in the overview; rebuild after changing it. |
| `TURNSTILE_SECRET_KEY` | Runtime secret | Server-side token verification. |
| `CLOUDFLARE_ACCOUNT_ID` | Runtime variable | Account that has Email Service sending enabled. |
| `EMAIL_API_TOKEN` | Runtime secret | Token with the email-sending permission for that account. |
| `EMAIL_FROM` | Runtime variable | A bare email address authorized by the verified sending domain. |
| `CONTACT_RECIPIENT` | Runtime variable | The fixed destination for inquiries. It cannot be supplied by a visitor. |

Cloudflare Email Service must be enabled for the account and the sender/domain
must be verified. Configure both Preview and Production, confirm availability,
permissions, sender, recipient, and Turnstile hostnames, and perform a real
delivery test before relying on this feature.

Set up Turnstile for `ofs-demos.endian.dev` and the project's applicable preview
hostnames. The handler accepts same-origin requests only from production,
`design-templates-27d.pages.dev`, its preview subdomains, and HTTP localhost for
local tests. It also checks that the verified token's hostname matches the
request host and its action is `contact`. Custom domains require an explicit
allowlist change.

The handler validates bounded JSON fields, rejects the honeypot, verifies a
fresh Turnstile token, and sends plain text with the visitor's validated address
as `reply_to`. Sender, recipient, and subject are server controlled. Success is
reported only after Cloudflare confirms the configured recipient in `delivered`
or `queued`, with no API errors or permanent bounces. A queued message is
accepted for delivery; it is not a promise of eventual inbox delivery. Unknown
outcomes ask the visitor to email before retrying. Responses are not cached,
and the application does not store or log submitted message content.

The browser preserves inputs on failure and prevents duplicate pending submits.
After confirmed acceptance, a confirmation panel replaces the form; only the
message and honeypot are cleared. Sending another message restores editable
contact details from the current page and starts a fresh spam check. Without a
site key or JavaScript, it offers email instead of implying a message was sent.

Official references: [Email REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/),
[Email API schema](https://developers.cloudflare.com/api/resources/email_sending/methods/send/),
[Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/).

## Design sources and maintenance

The public collection, in order:

1. **Quiet Welcome** — `/designs/quiet-welcome/`, with the original five-page navigation.
2. **Pilgrim’s Path** — `/designs/pilgrims-path/`, with the full section-based design.
3. **Living Tradition** — retained at `/designs/st-margaret-2026/direction-a/`.
4. **Come and See** — retained at `/designs/st-margaret-2026/direction-b/`.
5. **Gospel to Life** — retained at `/designs/st-margaret-2026/direction-c/`.

Quiet Welcome and Pilgrim’s Path were imported from the reviewed
`Secular-Franciscan-Order/st-anthony-fraternity` revision `ccd8d13`.
They are faithful static ports of the full page/component markup and CSS,
including the local Saint Francis portrait. Each source CSS module has its own
prefix (`qs`, `qp`, `pp`, `df`) to preserve module isolation. Source preview
bars, framework imports, React/Vinext hydration, and real fraternity-specific
contact/location data were removed. The sibling working tree was not used or
modified. The other three designs retain their complete existing layouts and
features, with the same fictional sample content.

`src/data/templates.json` controls public ordering, design names, thumbnails,
and legacy URLs. `src/data/sample-fraternity.json` records canonical sample
facts; the build guard checks the static designs against it. Shared fictional
visit and newsletter pages provide functional local links without pretending
to supply real directions or regional publications. Shared demo behavior lives
in `public/designs/demo-enhance.js`; mobile menus derive their links from each
design's own navigation.

The archived **Current Site** raw pages and `?d=st-margaret-2026/current-site`
preview URL remain unchanged for existing bookmarks. It is unlisted, retains
its historical source content, and shows an archived state outside the public
five-design sequence. Other `?d=` URLs and browser Back/Forward work as before;
obsolete device parameters are discarded.

### Gallery thumbnails

Thumbnails are intentional, optimized JPEG site assets captured from actual
full demo homepages. To refresh them after a visual/content change, first build
the site, then run the explicit capture variant of the full-route smoke tests:

```sh
pnpm build
UPDATE_THUMBNAILS=1 pnpm test:e2e --grep 'full demo'
pnpm build
```

These tests check each page's title, content, sample identity, and structure
before capturing its 1280×800 viewport. Ordinary e2e runs never alter images.
Review the captured gallery visually and commit only the intended JPEGs, not
`dist`, Playwright reports, or other generated artifacts.

## Cloudflare Pages

- Existing project: `design-templates`
- Pages domain: `design-templates-27d.pages.dev`
- Production domain: `ofs-demos.endian.dev`
- Production branch: `main`
- Root directory: repository root
- Build command: `corepack enable && corepack prepare pnpm@11.5.0 --activate && pnpm install --frozen-lockfile && pnpm build`
- Static output: `dist`
- Function route: `/api/contact` only, via `public/_routes.json`

Feature branches use the existing Git-connected Pages preview deployment flow.
Confirm the actual successful deployment URL after pushing the PR; do not
assume a preview is ready just because a branch exists. No new hosting project,
SSR adapter, Worker request router, or `wrangler.jsonc` is needed.

The landing page remains indexed. `/preview` and `/designs/*` remain noindexed
through metadata and Pages headers. No secrets or local environment files
belong in git.
