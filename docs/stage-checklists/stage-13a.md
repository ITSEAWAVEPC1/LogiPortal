# Stage 13a — Shared `AppShell` + Hamburger Drawer (Dashboard) + Viewport + Modal Mobile Mode

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Playwright-driven
browser verification (login → drawer open/close via hamburger/nav-link/backdrop/Escape →
desktop breakpoint → Modal mobile/desktop) all passed against the running dev server, no
console errors. First of four Stage 13 (Mobile Web Compatibility) sub-stages. Committed on
branch `stage-13a-appshell-drawer` (off `main`); **not pushed**.

## What was built

### The problem
The sidebar (`src/components/layout/Sidebar.tsx`) was a hardcoded `w-60` `<aside>`, always
rendered, with zero responsive classes anywhere in the app's layout code. On a phone it
consumed the full viewport width, leaving nothing for `<main>` — the reported "can't see
anything but the sidebar" bug. No hamburger/drawer logic existed anywhere in the codebase.

### `AppShell` — new shared shell (`src/components/layout/AppShell.tsx`)
Generalizes the old `Sidebar.tsx` + the dashboard layout's manual flex wrapper into one
reusable component both `(dashboard)` and (from 13d) `(portal)` consume:
- Props: `navItems: AppShellNavItem[]`, optional `sidebarFooter?: ReactNode` (unused by the
  dashboard; the portal will pass its user/sign-out block here in 13d), `children`.
- `useAppShellDrawer()` context hook exposes `{ open, toggle, close }` so each caller's own
  header decides where to put the hamburger trigger — `AppShell` itself doesn't know about
  `Topbar`.
- Sidebar renders `fixed inset-y-0 left-0 z-50 ... lg:static lg:translate-x-0`, sliding via
  `translate-x-0` / `-translate-x-full` off `open`. A `fixed inset-0 z-40 bg-black/40
  lg:hidden` backdrop closes the drawer on click. Escape-to-close reuses `Modal.tsx`'s exact
  `useEffect`+`keydown` pattern. Every nav `<Link>` (including sub-links) calls `close()`
  `onClick` so tapping a destination also closes the drawer.
- `AppShellNav` is `Sidebar.tsx`'s old `SidebarNav` moved in verbatim (same
  active-link/sub-link/`useSearchParams()`+`Suspense` requirement).

### Wired into the dashboard
`src/app/(dashboard)/layout.tsx` now calls `<AppShell navItems={getVisibleNavItems(session.user.role)}>` wrapping `<Topbar/>` + `<main>` (gutter `p-4 lg:p-6`) + `<Toaster/>`. Stays a Server
Component — `Topbar` (`"use client"`) calls `useAppShellDrawer()` fine since Context flows
between Client Components regardless of which Server Component authored the tree.

**`src/components/layout/Sidebar.tsx` deleted** — its only importer was the dashboard
layout; fully superseded (same practice as Stage 10d deleting a superseded route file).

### `Topbar` — hamburger trigger + mobile fit
Added a `Menu` (lucide-react) button (`lg:hidden`) calling `toggle()`, as the header's first
child. The search `<input>` is now `hidden ... lg:block` — a 64px header can't fit
hamburger + search + branch-select + bell + user-dropdown at 375px (see Explicitly
deferred). Added `min-w-0`/`truncate` to the user-name/role spans and the dropdown trigger
so a long name shrinks instead of overflowing.

### `Modal` — mobile full-screen sheet
Below `lg`: fills the viewport (`h-[100dvh] w-full`, no radius/border, `overflow-y-auto`).
At `lg+`: unchanged centered `max-w-md` card, plus a new `lg:max-h-[90dvh] overflow-y-auto`
safety net for tall content on short desktop windows (a latent bug fix, zero risk). Caller
`className` width overrides had to become `lg:`-prefixed or they'd also apply on mobile and
reintroduce overflow — the only two affected call sites:
- `src/components/ui/ColumnPicker.tsx:30` — `max-w-2xl` → `lg:max-w-2xl`
- `src/app/(dashboard)/jobs/_components/DocumentsPanel.tsx:490` — `max-w-3xl` → `lg:max-w-3xl`

All other 12 `<Modal>` call sites pass no width override and get the new mobile/desktop
split automatically.

### Viewport meta
`src/app/layout.tsx` gained an explicit `export const viewport: Viewport = { width:
"device-width", initialScale: 1, viewportFit: "cover" }` (none existed before — clean
addition, nothing to conflict with). `viewportFit: "cover"` matters now that the drawer/Modal
go edge-to-edge on notched phones.

## Breakpoint convention (applies to all of Stage 13)

Single cutover at Tailwind's stock `lg` (1024px), used everywhere: drawer, and (in later
sub-stages) table card-mode, form grid collapse, `StepTracker` orientation. Reasoning: the
sidebar reserves a fixed 240px; at `md` (768px) only 528px remains — not enough for the
app's 6–9 column tables to render without breaking, so a device between 768–1023px would hit
a broken half-desktop state. At `lg` (1024px), 784px remains, matching how these screens were
implicitly designed. iPad-portrait (768px) correctly gets the mobile treatment instead of a
cramped desktop layout. No `tailwind.config`/`@theme` change needed — plain `lg:` utility
classes throughout.

Mechanism: pure CSS dual-render (`hidden lg:block` / `lg:hidden` pairs), not
`matchMedia`/`useMediaQuery` — matches 100% of the app's pre-existing responsive code and
avoids hydration-mismatch risk. The only real interactive state is the drawer's open/closed
`useState` boolean, same pattern `Modal`/`ColumnPicker` already use for their `open` prop.

## Files touched

- **New**: `src/components/layout/AppShell.tsx`
- **Modified**: `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`,
  `src/components/layout/Topbar.tsx`, `src/components/ui/Modal.tsx`,
  `src/components/ui/ColumnPicker.tsx`, `src/app/(dashboard)/jobs/_components/DocumentsPanel.tsx`
- **Deleted**: `src/components/layout/Sidebar.tsx`

## DB models added

None — pure UI/CSS.

## Endpoints added/changed

None.

## Permissions

None. `access-matrix.ts`/`capabilities.ts`/`field-permissions.ts` all untouched —
`getVisibleNavItems(role)` is called exactly as before, just from the layout instead of from
inside `Sidebar`.

## Key decisions

1. **`lg` (1024px) as the one breakpoint for all of Stage 13** — see reasoning above.
2. **CSS dual-render over `matchMedia`** — no hydration-mismatch risk, matches existing
   codebase convention.
3. **`AppShell` decoupled from `Topbar` via a context hook** (`useAppShellDrawer`) rather
   than owning the hamburger button itself — lets the portal's very different header (no
   search/branch-select, built in 13d) place its own trigger without `AppShell` needing to
   know about either header's contents.
4. **`Sidebar.tsx` deleted outright**, not deprecated/left in place — confirmed via grep it
   had exactly one importer, fully superseded.
5. **Modal caller `className` overrides must be `lg:`-prefixed** going forward — documented
   here so a future wide modal doesn't reintroduce mobile overflow by adding an unprefixed
   `max-w-*`.

## Explicitly deferred

- **Mobile search box** — hidden below `lg` rather than redesigned into the mobile header;
  no screen currently depends on it being reachable from a phone. Revisit if customer
  feedback asks for it.
- **The ~900–1023px "half-split laptop window" trade-off** — a browser window in that range
  sees the mobile drawer/treatment even though it may have room for desktop. Accepted given
  the fixed 240px sidebar; revisit only if this proves annoying in practice.
- **Locking background scroll while the drawer is open** — the app's existing `Modal` doesn't
  do this either (no scroll-lock convention exists), so the drawer matches that precedent
  rather than introducing a new one.

## Verification

Playwright (installed with `npm install --no-save playwright` + `npx playwright install
chromium` for this verification pass only, then fully uninstalled afterward — not a project
dependency) drove a headless Chromium against the already-running dev server, logged in as
`admin@test.seawave.com`, and checked, at 375×667:
- Sidebar off-screen by default, hamburger visible, `scrollWidth === clientWidth` (no
  horizontal overflow).
- Hamburger opens the drawer (`aside` slides to `x=0`), backdrop visible, close (X) button
  visible, full nav text present including the Jobs → Imports/Exports sub-links.
- Clicking a nav link (Customers) navigates to `/customers` **and** closes the drawer.
- Clicking the backdrop closes the drawer; pressing Escape closes the drawer.
- Resizing to 1280×800 makes the sidebar permanently visible (`x=0`) with the hamburger
  hidden — matches the original desktop look exactly.
- A Modal (`/settings/users` → "New User") is a true full-screen sheet at 375×667
  (`{x:0,y:0,width:375,height:667}`, `border-radius: 0px`) and reverts to the original
  centered `448px`-wide rounded card (`border-radius: 8px`) at 1280×800.
- Zero console/page errors throughout.

`tsc --noEmit`, `eslint src`, `next build` all clean (all 59 routes compiled).

## Failover

Pure additive UI/CSS, no data/schema involved. Revert = drop branch
`stage-13a-appshell-drawer` (or `git checkout main -- <file>` per-file). No cleanup needed —
the Playwright verification touched no application data, and the temporary Playwright
package was uninstalled after use.
