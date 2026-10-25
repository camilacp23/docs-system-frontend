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

## 8. Values confirmed in Figma during F-01 (differences with the sections above)

Read with `get_design_context` on S-47, S-43b, S-01c, S-41c, S-17 and the status tags of S-27 (file `zZNDo3yEXP6UubLzEWAHe5`).
These are implemented in `src/styles/theme.css`.

| Item | Figma value | Note |
|---|---|---|
| Documentation status **tag** | In progress `#1d58a0` on `#e7effa` · In review `#8a4300` on `#ffe9cf` · Approved `#17663a` on `#e3f3e8` · Draft `#3f5468` on `#e3eaf1` · Undocumented `#4d5864` on `#eef1f4` with 1 px dashed `#d9dee5` border; dot = text color, 11.5 / 700, 22 px high, padding 0/9, gap 4 | The five fixed colors of §1 are the chart / legend colors (dashboard donut). Tags use the darker pairs (AA ≥ 6:1). Draft and Undocumented sampled from the S-18 render (exact match checked on In progress). |
| S-47 page title | 20 / 28, weight 600 | §2 says page title 24 / 32 / 800 (S-43b uses 24 / 800). Token `title` = 20 / 28; `page-title` = 24 / 32. |
| Avatar initials color | `#5b6577` (Figma) | §1 says `#1f4f8f`. `#1f4f8f` kept (AA ≥ 5:1 on the gradient; `#5b6577` gives ≈ 3.8:1). |
| Modal | max width 400, radius 14, overlay `rgba(10,23,48,.45)`, shadow `0 12px 32px rgba(22,33,43,.2)`, header 16/600 padding 16/20 with bottom border `#e3e8ed`, body 14/20 padding 20, footer `#fafbfd` with top border, padding 12/20, gap 8, top offset 120; close button 30 px radius 8 with teal X | Applies to the small size. |
| Danger button | `linear-gradient(180deg, #c42b1f, #b42318)`, white 13.5 / 700, no shadow | Not in §1. |
| Secondary button | white, 1 px `#d3d9e2`, text `#101828`, card shadow | |
| ErrorState (S-41) | circle 64 px `#eaeef2`, icon 30 px `#344054`, title 24 / 32 / 600, text 14 / 20 `#5b6577` (max 460), gap 11.5, "Reference:" 12 + id in IBM Plex Mono 13 | EmptyState differs: circle 56 px `#e4f1f4`, icon 26 px teal, title 16 / 24, padding 56 / 24, gap 10. |
| Input | 36 px, radius 10, padding 8/12, text 14/regular (13 IBM Plex Mono for identifiers), invalid border `#b42318`, field error = 14 px icon + 12/16 text | |
| Icons | Lucide, stroke 1.75 (24-unit grid): `CircleAlert` for info, warning, danger, field error and server error; `Check` for success and toast; `Clock` for rate limit and warning toast; `Database`, `Plus`, `X`, `Search`, `Lock` | Info, warning and danger banners share the same glyph; the tone is told by color and the bold lead word. |
| Element type color | **none defined** | Decision (F-01): shape only, neutral color (`ElementTypeIcon`). |
| Sidebar glyphs | Identified in F-03 by comparing the SVGs exported from S-31 (nodes in `2:15800`) with Lucide: Dashboard `LayoutDashboard`, Screens `Monitor`, Variables `Variable`, Collections `Database`, Dependency map `Network`, Advanced search `Search`, Reports `FileText`, Onboarding `BookOpen`, Review `ClipboardCheck`, Audit log `History`, Users & roles `Users`, Applications `LayoutGrid`; application switch `ChevronsUpDown`; archived strip `Archive`. | S-09b, S-43a and S-46 render some of these glyphs differently (older exports); S-31 is the reference. |

## 9. Derived values (pending design confirmation)

Not in this document nor in the Figma file; derived from existing tokens in `src/styles/theme.css`.
Contrast computed per WCAG 2.x (text ≥ 4.5:1, components and focus ≥ 3:1).

| Token | Derivation | Contrast |
|---|---|---|
| `--gradient-primary-hover` | each stop of `--gradient-primary` mixed 88 % with `navy-950` | white text 6.6:1 (top) / 8.0:1 (bottom) |
| `--gradient-primary-active` | same, 76 % | white text 7.6:1 or more |
| `--gradient-danger-hover` / `-active` | each stop of `--gradient-danger` mixed 88 % / 76 % with `ink-900` | white text 7.7:1 / 8.9:1 on `#b42318` stop; ≥ 5.7:1 on the light stop |
| `--color-control-hover` | = `search-bg` `#f4f6fa` (secondary and ghost buttons, hover) | `ink-900` 15.2:1 · `primary` text 6.5:1 |
| `--color-control-active` | = `disabled-bg` `#eaeef2` (secondary and ghost buttons, pressed) | `ink-900` 15.2:1 · `primary` text 6.0:1 |
| `--color-border-control` | `border` 30 % + `ink-500` 70 % = `#7f8897`; border of form controls only (TextField, PasswordField, secondary Button). Dividers, cards and other decorative borders keep `border` `#d3d9e2`. Derived for accessibility (WCAG 1.4.11), pending confirmation in design | 3.6:1 on white · 3.3:1 on `canvas` (≥ 3:1 required) |
| `--color-border-control-hover` | = `ink-500` `#5b6577` (control hover) | 5.9:1 on white · 5.3:1 on `canvas` |
| `--color-focus-ring` | = `accent`; ring 2 px, offset 2 px (approved) | 3.9:1 on white · 3.6:1 on `canvas` · 4.1:1 on `navy-900` |
| Input focus border | `accent` (seen on the focused field of S-42) | 3.9:1 on white |
| Disabled secondary / ghost / danger | same flat look and opacity .45 as the disabled primary button (Figma only shows the primary) | exempt (inactive component) |
| Ghost button | transparent, text `primary`, 1 px transparent border | `primary` on `canvas` 6.4:1 |
| Modal `md` / `lg` widths | 560 px / 720 px (`sm` = 400 px is from Figma) | n/a |
| Toast timing | default tone closes after 5 000 ms; warning tone stays until dismissed; both pause while hovered or focused; no cap on stacked toasts | n/a (WCAG 2.2.1: pause on hover / focus) |
| Spinner | 3 px arc, `currentColor`, 0.25 track; static under `prefers-reduced-motion` | n/a |
| Skeleton animation | none (the Figma frame is static) | n/a |
| Text for a failed call with no answer (`NETWORK_ERROR`) | the S-46 offline banner copy: "You're offline. Changes can't be saved until the connection is back." | n/a |
| Text for `UNEXPECTED_RESPONSE` and for an unknown error code | the `INTERNAL_ERROR` text of Table 59 without the reference sentence when there is no request id: "Something went wrong on our side. Try again in a moment." (with " Reference: <requestId>." when there is one) | n/a |
| Neutral placeholders when `details` lacks a value | `<element>` → "resource", `<type>` → "item"; `<name>` → "this item", `<application>` → "this application", `<variable>` → "this variable" (a programming error: `console.warn` in development only). Also "its origin screen" (`<screen>` of `CONTEXT_SCREEN_MISMATCH`), "another function" (`<function>`), "a few minutes" (`<n>`); `TEMPLATE_INCOMPLETE` and `JIRA_PARTIAL_FAILURE` drop the missing list / key. `<n>` = 1 reads "1 minute" | n/a |
| Field-level validation texts (by rule, replacing the server text) | `required` "<Label> is required." · `pattern` / `format` "<Label> isn't in a valid format." · `minLength` "<Label> is too short." · `maxLength` "<Label> is too long." · `enum` / `const` "Choose one of the available options for <Label>." · `minimum` / `maximum` / `range` "<Label> is below / above / outside the allowed range." · `minItems` "Add at least one item to <Label>." · `maxItems` "<Label> has too many items." · `unique` / `uniqueItems` "<Label> has repeated values. Each one must be unique." · `type` "<Label> has an unexpected type of value." · `CHECK` "<Label> doesn't meet the required conditions." · no label "This field" · unknown rule "This value isn't valid." | n/a |
| Field-level text of the `unique` rule with a position (F-05) | Same text as without position: "<Label> has repeated values. Each one must be unique." The row is not named in the text; the position (`details.fields[].field`, e.g. `fields[3].name`) only tells the form which field to mark. Approved in F-05, pending confirmation in design | n/a |
| Field-level text of the `self` rule (F-05, D-74) | "<Label> can't point to itself." Generic by rule (it will also serve self-navigation in Module 4); the screen passes the label, e.g. "Derived from" for collections. The backend text of D-74 ("A collection cannot derive from itself.") is not shown. Approved in F-05, pending confirmation in design | n/a |
| Empty state when no application is registered (approved in F-03) | Title "No applications yet"; text "An administrator needs to register an application before documentation can start."; no action. Shown in the shell instead of the page, except on `/admin/applications` | n/a |
| S-43b "Your session ended" body (F-03) | The sentence "Your unsaved changes on this page are kept in this browser." is **left out until forms keep drafts** (pending: restore it together with the forms with drafts). When the session was revoked before the 12 h limit the body is the `REFRESH_INVALID` text of Table 59: "Your session ended. Sign in again to continue." | n/a |
| S-41a for an unknown route (F-03) | `<element>` = "page", list = "Dashboard": "This page doesn't exist" / "Back to Dashboard" | n/a |
| Sign out when the server cannot be reached (F-03) | The session is cleared locally and a warning toast says: "You're signed out on this device, but the server couldn't be reached to end the session." | n/a |
| S-43a time (F-03) | Local time of the browser in 24 h `HH:MM` (en-GB), e.g. "18:05" | n/a |
| Shell details not shown in the frames (F-03) | Archived application card: the chip "Archived · read-only" replaces the platform line (as in S-09b). The application selector (list of applications) and the user menu ("Sign out") are small white popovers with `shadow-modal`; the frames do not draw them open. Breadcrumb on detail routes shows only the section title. Status strips: padding 10/24, gap 12, bold lead sentence, Unarchive button right after the text (S-09b) | n/a |
| Elements of the shell left out until their module exists (F-03) | Jira status pill, quick search (Ctrl K), Review counter, screen count in the application card, help button and "Collapse" | n/a |
| Breadcrumb on detail and edit routes (F-06, reverses the F-03 note) | S-11 and S-12b draw the name in the breadcrumb: "Variables / gUsuario" on the detail and "gUsuario / Edit" on the edit page (approved in F-06). The page sets the text with `useBreadcrumbLabel`; list pages keep the section title | n/a |
| Data type labels (F-06) | The names Microsoft gives the Power Fx data types (Microsoft Learn, Power Fx "Data types"): Boolean, Choice, Color, Currency, Date, DateTime, Decimal, Dynamic, Float, GUID, Hyperlink, Image, Media, Number, Record, Record reference, Table, Text, Time, Yes/No. Derived, pending confirmation in design | n/a |
| Variable list texts (F-06) | Frame texts: title "Variables", subtitle "Global and context variables of <application>, with where they are created and used.", counters "Variables", "Global · Set", "Context · UpdateContext", "Without origin screen · filter", tabs All / Global / Context, search "Search by name…", selects "Data type", "Environment", "Origin screen", columns Name / Scope / Environments / Origin screen / Updated, tag "Untraced", "Showing 1–5 of 5", "Rows per page", buttons "View on map" and "New variable". New: empty state "No variables yet" / "Record <application>'s variables and where they are created."; no results "No results" / "No variables match these filters." with "Clear filters"; archived subtitle "Read-only: the application is archived." (S-09b); row menu "View", "Edit", "Delete" | n/a |
| Variable list look (F-06) | Scope and environment tags use the existing tone tokens (`info`, `neutral`, `success`, `warning`); the purple of the prototype's tags has no token and no per-type color is invented. An environment the variable does not have is not drawn (the frame draws it greyed). Only the columns of the contract's sort whitelist that the table shows are sortable (Name, Scope, Updated; `dataType` has no column). Variable rows use the neutral `braces` icon for every data type | n/a |
| New variable and edit form texts (F-06) | Frame texts: "New variable", subtitle "<application> · Global or context variable", "Unique in <application>" with the counter "n/150", "Global (Set)" / "Context (UpdateContext)", "Context variables exist only in the screen where they are created.", "Leave empty if unknown; the variable is then untraced.", "Notes for DEV (optional)", "Usage is linked from each screen" / "Reads and writes are added in the screen or the collection.", "Create variable", "Save changes", "Cancel". New: first origin option "None (untraced)"; "Choose a data type" (only when the data type is empty); for a context variable "Context variables can't originate in App (OnStart)." (shown with the option disabled; choosing Context clears an App (OnStart) origin). S-12b draws the scope as radio buttons; the same segmented control of S-12a is used on both pages. The form has no summary banner (Table 58: only long forms) | n/a |
| Toasts of module 2 (F-06) | "<name> created." with the action "Open"; "Variable saved." (S-47); "<name> deleted."; "Switched to <application>." (D-78). Pattern of Table 59: past tense, the object named | n/a |
| Variable detail texts (F-06) | Frame texts: cards "Screens", "Fed from collections", "Used by components", "Details"; "Origin" tag; "No known differences."; "Links are edited in the screen (Module 4) or the collection." with "Open in dependency map". New: empty cards "No screen uses this variable yet.", "No collection feeds this variable.", "No component uses this variable."; "No description."; failed dependencies: "Couldn't load where this variable is used." + the catalog text + "Try again" (the rest of the page keeps working) | n/a |
| Delete variable texts (F-06) | Frame text of S-13: "Delete <name>?", "<name> is used in 3 screens, fed from 1 collection and used by 1 component. Those links are deleted too. The audit log keeps a record of everything deleted.", "Delete variable". The origin screen counts as a screen; a part with zero is left out. New: "<name> isn't linked to anything." (nothing linked), "Checking what depends on this variable…" (loading), "Couldn't check what depends on this variable." + the catalog text + "Try again" (Delete stays disabled until the impact is known) | n/a |
| Edit conflicts and disabled saving (F-06) | S-44 text with the catalog sentence of PRECONDITION_FAILED followed by "Your changes will be lost, so copy anything you need first." and the buttons "Keep my changes visible" / "Reload". After "Keep my changes visible" the banner is hidden and the catalog sentence stays next to Save, which stays disabled. Reasons next to a disabled Save, Create or Delete: "Read-only: the application is archived." (archived) and "You're offline. Changes can't be saved until the connection is back." (offline) | n/a |
| Scope conflict (F-06) | Banner (danger) with the catalog text of SCOPE_CONFLICT followed by the names of the collections, in IBM Plex Mono, linked to their page (frame S-12b). Under the scope: "Scope conflicts with <N> <function> assignment(s)." (frame text with "assignments" for N ≠ 1). Both come from a fresh read of `GET /variables/{id}/dependencies` after the 422; if that read fails only the banner is shown | n/a |
| Collection list texts (F-07) | Frame texts (S-14): title "Collections", counts "4 collections · 1 not linked to any screen" (the second part is a button that toggles the filter), search "Search by name…", select "Environment", button "Not linked to any screen", columns Name / Environments / Fields / Linked to screens / Updated, "Yes", tag "Not linked", "Showing 1–4 of 4", "Rows per page", button "New collection". New: empty state "No collections yet" / "Record <application>'s collections, their fields and the variables they feed."; no results "No results" / "No collections match these filters." with "Clear filters"; archived: "Read-only: the application is archived." replaces the counts; row menu "View", "Edit", "Delete". "Linked to screens" is `documented` (D-79). The frame's caption "Sample data (names from SDD examples)" is not drawn. Collection rows use the neutral `database` icon | n/a |
| New collection modal texts (F-07) | Frame texts (S-14n): "New collection", subtitle "<application> · <platform> collection", "Unique in <application>" with the counter "n/150", Description placeholder "What the collection holds", "Creation condition" (IBM Plex Mono), "Environments" with "Notes for DEV (optional)", "Fields" with "Order = row order", "Add field", columns "#", "Name *", "Data type *", footer "Variable assignments come next" / "Add them after creating, from Edit collection.", "Cancel", "Create collection". New: "No fields yet." (no rows); a new field starts as Text; every control of a row names its row ("Name of field 2", "Data type of field 2", "Remove field 2") | n/a |
| Collection detail texts (F-07) | Frame texts (S-15a-c): tabs "Overview", "Fields" and "Variable assignments" with their counts, cards "Creation condition" and "Details" ("Description", "Derived from", "None", "No known differences."), fields columns "#", "Name", "Data type", "Description", assignments columns "Variable", "Function", "Table function", "Screen", "Used in" (function tags "Set" / "UpdateContext"). New: "No description.", "No creation condition.", a "Linked to screens" row ("Yes" or the tag "Not linked"), "No fields yet.", "No variable assignments yet.", "—" for an empty table function or description, failed fields: "Couldn't load the fields." + the catalog text + "Try again" (the rest of the page keeps working). The card "Used by screens" is not drawn until module 4 (D-79). Tabs: active tab `navy-900` with white text and a count badge, as in the frame; the tab is the URL parameter `?tab=fields` / `?tab=assignments` (Overview is the default and leaves no parameter); the fields page and size are `fpage` and `fsize`. Derived, pending confirmation in design | n/a |
| Edit collection layout and reordering (F-07) | S-16 draws "General" (subtitle "Name, creation condition and environments") and the start of "Fields" ("Order = row order; drag to reorder", "Add field", columns "#", "Name *", "Data type *", "Description") and stops there. The rest is derived from the same card pattern, pending confirmation in design: "Variable assignments" (subtitle "Which variables this collection feeds, where and how", "Add assignment", columns "Variable *", "Function *", "Table function", "Screen *", "Used in *", placeholders "Choose a variable / function / screen", "No variable assignments yet.") and "Derived from" (subtitle "Collections this one is built from (N of at most 50)", a list of checkboxes in IBM Plex Mono, "Filter collections…" when there are more than 6, "There are no other collections in this application."). Reordering uses the buttons "Move field N up" / "Move field N down" instead of dragging (keyboard accessible, no new dependency); hint "Order = row order; use the arrows to reorder"; the focus stays on the button that moved the row and a polite live region says "Field <name> moved to position N of M." Choosing a variable suggests the function of its scope (Set for global, UpdateContext for context) unless one was chosen by hand. Long form: the danger banner "N fields need attention." ("1 field needs attention.") with a button for each control. Title "Edit <name>", breadcrumb "<name> / Edit", toast "Collection saved." | n/a |
| Delete collection texts (F-07) | Frame text (S-17): "Delete <name>?", "Its 8 fields, 3 variable assignments and its links to 2 screens are deleted too. The audit log keeps a record of everything deleted.", "Delete collection". Derived (D-79): "Its 8 fields, 3 variable assignments and 1 derivation are deleted too." with only the parts that exist ("Its 1 field is deleted too." for a single one), no count of screens; "<name> has no fields or links." when there is nothing; "Checking what depends on this collection…" (loading) and "Couldn't check what depends on this collection." + the catalog text + "Try again" (Delete stays disabled until the impact is known). Toasts: "<name> created." with "Open", "Collection saved.", "<name> deleted." | n/a |

The Figma border of inputs and secondary buttons (`#d3d9e2`, 1.4:1 on white) does not meet WCAG 1.4.11 (3:1 for component
boundaries); `--color-border-control` replaces it on those controls only. To confirm in design or in SDD v1.1.
