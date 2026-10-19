# CLAUDE.md — docs-system-frontend

React SPA of **"Documentación técnica"**, the technical documentation management system of the
Enterprise Architecture Department. It consumes the REST API of the `docs-system-backend` repository.
Phase 3 (development). The design (Phase 2) is complete and approved: implement it, do not redesign it.

## 1. Sources of truth (read before changing anything)

| Priority | Source | Path | Governs |
|---|---|---|---|
| 1 | SRS v1.3 | `docs/requirements/SRS_v1.3.md` | WHAT (FR/NFR, roles Table 26, standards §3.7, NFR-07/08: consistent UI, **English interface**, product name "Documentación técnica") |
| 2 | SDD v1.0 | `docs/design/SDD_v1.0.md` | HOW: frontend §4.2, UI §7.3 (Tables 54–59), routes D-57, session §8.3/§11.2, R-4 |
| 3 | API contract (copy) | `contract/openapi.yaml` (+ `contract/SOURCE.md`) | Request/response shapes and error codes. Types are generated from it — never hand-write API types. |
| 4 | Design reference | `docs/design/DESIGN_REFERENCE.md` + `docs/design/frames/*.png` | Exact tokens, layout and copy extracted from the Figma prototype |
| 5 | Figma prototype | file key `zZNDo3yEXP6UubLzEWAHe5` (via the Figma MCP server, if connected) | Appearance (SDD §7.3: appearance → Figma; behavior → SDD/UI spec) |
| 6 | Phase 3 decisions / plan | `docs/phase3/DECISIONS_FASE3.md`, `docs/phase3/PLAN_SEMANA6.md` | Approved post-SDD decisions; task scope (F-xx) |

If sources contradict each other or something is undefined (a field, a message, a behavior, a
color not in the reference): **STOP and ask the user. Never invent.**

## 2. Stack (exact versions — pinned with `save-exact`)

Node ≥ 22.22 · React 19.3.0 / react-dom 19.3.0 · react-router 8.4.0 · Vite 8.3.2 ·
Tailwind CSS 4.3.3 (+ `@tailwindcss/vite` 4.3.3) · @xyflow/react 12.12.0 (Module 5, later) ·
lucide-react 1.59.0 · TypeScript 5.9.3 · Vitest + Testing Library · openapi-typescript.
New dependencies: exact latest stable version compatible with the above; justify in the commit.

## 3. Non-negotiable rules

1. **Security (SDD §11, D-37, R-4):** the access token lives only in memory (never localStorage /
   sessionStorage / cookies). The refresh token is an HttpOnly cookie the frontend never reads.
   At most one refresh in flight across all tabs. React output escaping only — no
   `dangerouslySetInnerHTML`.
2. **The API enforces permissions (NFR-03).** The route guard and role-based navigation are only for
   usability; never treat them as security.
3. **Errors:** act on `code`, never on the server `message`. User-facing text comes from the message
   catalog (SDD Table 59) in `src/api/messages.ts`; placeholders are filled from `details`.
4. **English UI** everywhere (NFR-08, D-49). Product name: "Documentación técnica".
5. **Design system only (NFR-07):** use the tokens in `src/styles/theme.css` and the components in
   `src/components/ui/`. No hard-coded colors/sizes in feature code.
6. **Routes are those of D-57.** Selected application = ApplicationProvider (sent as `applicationId`).
7. **Contract:** `npm run contract:sync` copies `../docs-system-backend/api/openapi.yaml`;
   `npm run contract:types` regenerates `src/api/schema.d.ts` (never edit it by hand).
8. **Standards (SRS §3.7):** components PascalCase (`ScreenDetail.tsx`) with a header comment
   (purpose + main props); camelCase functions; UPPER_SNAKE_CASE constants. Accessible markup
   (labels, roles, focus visible, keyboard). Chrome and Edge current (NFR-18); desktop responsive
   (NFR-19, SDD §7.3.7).

## 4. Git

`main` ← `develop` ← `feature/<name>`. Conventional Commits in English. Local commits allowed.
**Never `git push`, never open PRs, never rewrite history** — the user does that.

## 5. Environment

Windows 11 + Git Bash. Backend runs at `http://localhost:3000`; Vite dev server at
`http://localhost:5173` proxies `/api` to it (same origin for the browser).

## 6. Definition of done

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run contract:check`
green; visual check against the referenced frames; short report of files changed, tests (counts),
and anything left open or assumed.
