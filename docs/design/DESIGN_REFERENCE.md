# Design reference — extracted from the Figma prototype

Source: Figma file "Documentación técnica — Prototype", key `zZNDo3yEXP6UubLzEWAHe5`, page `Prototype`
(88 frames of 1440 × 900). Extracted on 2026-10-18 from the frames' generated code. The file has **no
Figma variables and no "Design system" page**, so the values below are the raw values used by the frames.
SDD §7.3.2 Table 54 is the normative summary; this document gives the exact values behind it.
Screenshots: `docs/design/frames/`. If a value you need is not here, read the frame with the Figma MCP
(`get_design_context` on the node id below) or ask — do not guess.

## 1. Color

| Token (suggested name) | Value | Used for |
|---|---|---|
| `canvas` | `#f2f4f8` | App background, sign-in right side |
| `surface` | `#ffffff` | Cards, inputs, modals |
| `navy-900` | `#0e2041` | Sign-in left panel; sidebar gradient start |
| `navy-950` | `#0a1730` | Sidebar gradient end; toast background |
| sidebar background | `linear-gradient(180deg, #0e2041 0%, #0a1730 100%)` + radial highlight `rgba(24,54,106,1)→0` at top-left | Sidebar |
| `primary` (teal) | `#0e6175` | Links, text buttons ("Show"), primary actions |
| `primary-gradient` | `linear-gradient(180deg, #147088, #0e6175)` | Primary button fill (+ inset `0 1px 0 rgba(255,255,255,.15)`) |
| `accent` (blue) | `#3d81d9` | Active nav, focus, charts, brand tile |
| `accent-soft` / `accent-ink` | `#e8f1fc` / `#1f4f8f` | Breadcrumb application chip |
| `ink-900` | `#101828` | Primary text, headings |
| `ink-700` | `#344054` | Labels, secondary strong text |
| `ink-500` | `#5b6577` | Secondary text, placeholders, helper text |
| `border` | `#d3d9e2` | Inputs, secondary buttons, search |
| `border-subtle` | `#e4e8ee` | Cards, top bar bottom border |
| `divider` | `#f0f2f6` | Row separators |
| `search-bg` | `#f4f6fa` | Top-bar search field |
| `danger` | `#b42318` | Error text, required `*`, invalid input border |
| `danger-bg` / `danger-border` | `#fcebe9` / `#f3c4bf` | Error banner |
| `warning-ink` / `warning-bg` / `warning-border` | `#7a4a00` / `#fff1d6` / `#f0d9a8` | Warning banner (stale, archived, session ending, 412, rate limit, offline) |
| `success-ink` / `success-bg` / `success-border` | `#17663a` / `#e3f3e8` / `#bfe0cb` | Success banner |
| `success` / pill | `#16a06a` dot · `#16794a` text · `#e7f6ee` bg | "Jira connected" pill, live dot |
| `info-ink` / `info-bg` / `info-border` | `#1d58a0` / `#e8f0fb` / `#c5d7f0` | Info banner |
| `badge-warning` | bg `#f5a524`, text `#3b2500` | Review count badge in sidebar |
| `toast` | bg `#0a1730`, text `#ffffff`, link `#9fd3e0` | Toasts |
| `disabled` | bg `#eaeef2`, text `#5b6577`, opacity .45 | Disabled primary button |
| `skeleton` | `linear-gradient(90deg, #eaeef2, #f1f4f7 50%, #eaeef2)` | Skeleton bars (radius 4) |
| `empty-icon-bg` | `#e4f1f4` | Empty-state / error-page icon circle (56 px) |
| `avatar` | `linear-gradient(135deg, #d7e6fb, #b9d3f6)`, text `#1f4f8f` | User initials |
| `identifier` | `#123b6d` (IBM Plex Mono) | Power Apps identifiers inside prose |

**Sidebar (dark) palette:** nav text `#c9d4e6`; section label `#7088ac`; muted `#8ea2c2`, `#a9b8d0`,
`#7f93b4`; inactive icon tile `rgba(255,255,255,.05)`; active item `linear-gradient(90deg,
rgba(61,129,217,.30), rgba(61,129,217,.06))`, active icon tile `#3d81d9` (shadow `0 4px 6px
rgba(61,129,217,.5)`), active indicator bar `#7fb3ff` (3 px, left edge); application card bg
`rgba(255,255,255,.06)`, border `rgba(255,255,255,.10)`, radius 14; application initials tile
`linear-gradient(135deg, #3d81d9, #2a5fb0)` 40 px radius 11; brand tile `linear-gradient(135deg,
#1a86a0, #3d81d9)` 34 px radius 10; active-application dot `#34d399`.

**Documentation status (one fixed color + label each, SDD Table 54):**
Undocumented `#a7b0be` · Draft `#5b6b82` · In progress `#3d81d9` · In review `#e08a1e` · Approved `#16a06a`.

## 2. Typography

Fonts: **Plus Jakarta Sans** (400, 500, 600, 700, 800) for the interface; **IBM Plex Mono** (400, 600)
for Power Apps identifiers, formulas, usedIn values, Jira keys and keyboard hints.

| Role | Size / line height | Weight |
|---|---|---|
| Page title (shell) | 24 / 32, tracking −0.24 px | 800 |
| Sign-in heading | 24 / 32 | 600 |
| Sign-in hero | 32 / 40 (white) | 600 |
| Section title (Table 54) | 18 | 600–700 |
| Card title | 15 / 22 | 800 |
| Body | 13.5 / 20 (14 / 20 in banners and inputs) | 400 |
| Label | 13 / 18 | 500 |
| Small / helper / error | 12 / 16 | 400 |
| Button | 13.5 / 13.5 | 700 |
| Nav item | 13.5 / 20 | 500 (active 600, white) |
| Nav section label | 10.5 / 14, uppercase, tracking .945 px | 700 |
| KPI number | 30 / 38, tracking −0.6 px | 800 |

## 3. Size, spacing, radius, elevation

Controls 36 px high (small 30 px; sign-in primary button 40 px) · inputs: padding 8/12, radius 10,
border 1 px · buttons: padding 0/14, radius 10 · cards: radius 12, padding 20 (18–20), border
`#e4e8ee` · search field 40 px radius 12 · chips/pills radius 999 · icon tiles 40 px (nav icon tiles
28 px radius 8, icons 16 px) · card shadow `0 1px 1px rgba(16,24,40,.05), 0 1px 1.5px
rgba(16,24,40,.07)` · button shadow `0 1px 1px rgba(16,24,40,.10)` · toast shadow `0 4px 6px
rgba(22,33,43,.12)`, radius 12, padding 12/16.

## 4. Layout

- Frame 1440 × 900. **Shell:** grid `268px | 1fr` × `68px | 1fr`. Sidebar spans both rows, padding
  18/14, items 36 px high with 11 px gap. Top bar: background `rgba(255,255,255,.88)` + backdrop blur
  4 px, bottom border `#e4e8ee`, horizontal padding 28. Main: padding 20/24, gap 16. Long pages scroll
  inside the fixed shell (SDD §7.3.1).
- **Top bar:** left = breadcrumb starting with the application chip (initials tile 20 px + name), "/",
  current page (bold 13); center = search (560 px, placeholder "Search screens, variables, collections,
  components…", chip "in <app>", key hint "Ctrl K"); right = Jira status pill, help button (38 px),
  user block (avatar 36 px, name bold 13, role 11.5) — the user block opens Sign out.
- **Sidebar groups and items (exact labels, in order):** Dashboard · DOCUMENTATION: Screens,
  Variables, Collections, Dependency map · EXPLORE: Advanced search, Reports, Onboarding ·
  CONTROL: Review (with pending-count badge), Audit log · ADMINISTRATION: Users & roles, Applications.
  Footer: version text (left), "Collapse ‹" (right).
  - Administrator: all 12 items (S-31). Developer: 10 — no ADMINISTRATION (S-31j). Reader: 8 — no
    CONTROL, no ADMINISTRATION (S-31r, S-41b). (SDD Table 56.)
  - Application card at the top: "APPLICATION" label, name, platform (and screen count), switch button.
    Archived: chip "Archived · read-only" (S-09b).
- **Sign-in (S-01a):** grid `5fr | 7fr`. Left navy panel padding 56: brand (tile "DT" IBM Plex Mono
  600 15 on `#3d81d9`, 36 px radius 6 + "Documentación técnica" 16/600 white); hero "Technical
  documentation of the department's applications" (max width 420); sub "Screens, variables,
  collections and their dependencies, in one place, with review and Jira tracking." (`#8ea2c2`);
  footer "Enterprise Architecture Department · Sessions last up to 12 hours." (12/16). Right side:
  centered card 400 px, padding 32, gap 20: "Sign in" / "Use your department account." / Email * /
  Password * with "Show" toggle / primary button "Sign in" (40 px, full width) / "Forgot your
  password? Ask an administrator to reset it." (12, centered). SDD §7.3.7: the left panel collapses
  below 1280 px.

## 5. Component and state patterns (exact copy)

| Frame (node id) | Pattern | Exact content / behavior |
|---|---|---|
| S-01a (`7:2`) | Sign in default | See §4. |
| S-01b (`2:52`) | Invalid credentials | Danger banner above the fields: "The email or password is incorrect." |
| S-01c (`2:103`) | Field errors + rate limit | Warning banner "Too many attempts. Try again in 14 minutes."; invalid inputs with danger border and helper (icon 14 + 12/16 danger text): "Enter a valid email, e.g. name@domain.com." / "Enter your password."; button disabled: "Try again in 14:00" (live countdown). |
| S-47 (`2:23749`) | Feedback components | Banners: padding 10/14, radius 10, icon 18, bold lead word + text ("Info.", "Success.", "Warning.", "Error."). Toasts: "Variable saved." / "TECHEA-108 created. Open in Jira". Empty state card. Skeleton. |
| S-39a (`2:21215`) | Loading | Skeleton only after 300 ms; after 10 s: "This is taking longer than usual." |
| S-40a (`2:21705`) | Empty | Icon circle 56 px, title 16/600, one sentence 14 `#5b6577`, one primary action when the role can act. |
| S-41a (`2:22248`) | Not found | Search icon; "This <element> doesn't exist"; "It may have been deleted. Its history stays in the audit log."; button "Back to <list>". |
| S-41b (`2:22419`) | No access | Lock icon; "You don't have access to this page"; "Your role (<Role>) doesn't include it. Ask an administrator if you need it."; button "Go to Dashboard". |
| S-41c (`2:22556`) | Server error | Alert icon; "Something went wrong on our side"; "Try again in a moment. If it keeps happening, share the reference below with the team."; button "Try again"; "Reference: <requestId>". |
| S-42 (`2:22730`) | Form validation | Errors under each field; long forms add a danger summary banner "N fields need attention." with links to each field. |
| S-43a (`2:22963`) | Session ending | Warning toast bottom-right, dismissible: "Your session ends at **HH:MM**. Save your work; you'll need to sign in again after that." (10 min before the 12-h limit). |
| S-43b (`2:23159`) | Session ended | Modal "Your session ended" — "For security, sessions last up to 12 hours. Sign in again to continue where you were. Your unsaved changes on this page are kept in this browser." — button "Sign in" (returns to the same page). |
| S-44 (`2:23356`) | Concurrent change (412) | Warning banner "Someone else saved changes to this <element> after you opened it. Reload to see their version. Your changes will be lost, so copy anything you need first." + buttons "Keep my changes visible" / "Reload"; Save disabled. |
| S-46 (`2:23556`) | Offline | Full-width warning strip under the top bar: "You're offline. Changes can't be saved until the connection is back."; Save disabled. |
| S-09b (`2:4289`) | Archived application | Warning strip "This application is archived. Its documentation is read-only." + "Unarchive" (Administrator only); page subtitle "Read-only: the application is archived". |
| S-31 / S-31r / S-31j (`2:15799`, `2:16187`, `2:16489`) | Shell by role | Admin / Reader / Developer sidebars; Jira-unavailable variant shows a warning banner and "Stale" chip. |

## 6. Icons

lucide-react. Element types (SDD Table 54): monitor = screen, braces = variable, database =
collection, box = component. For the sidebar items, identify the exact Lucide glyph of each frame via
the Figma MCP before choosing; if unclear, ask.

## 7. Frames index for later modules (node ids)

M01 auth & admin: S-02 `2:167`, S-02b `2:1096`, S-02c `2:502`, S-02d `2:850`, S-03 `2:1451`, S-04 `2:1867`,
S-05 `2:2252`, S-06 `2:2637`, S-06b `2:2987`, S-07 `2:3342`, S-08 `2:3632`, S-09 `2:3984`, S-09b `2:4289`.
M02–03: S-10 `2:4524` … S-17 `2:7921`, S-14n `38:498`. M04: S-18 `2:8240` … S-26 `2:12465`.
M05–06: S-27 `2:12815` … S-30 `2:15357`. M07–08: S-31 `2:15799` … S-32f `2:17457`.
M09–11: S-33 `2:17743` … S-38c `2:20890`. States: S-39a `2:21215` … S-47 `2:23749`.
Prototype extras: P-01 `2:23972` … P-06 `2:25452`.
