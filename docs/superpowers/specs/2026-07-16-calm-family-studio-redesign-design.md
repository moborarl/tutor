# Calm Family Studio Redesign

Date: 2026-07-16
Status: Approved direction; Phase 1-2 selected for the current implementation cycle

## 1. Purpose

Redesign Kids Tutor as a calm, modern family learning workspace. The interface must feel professional to parents, friendly to children, and comfortable for long sessions without becoming visually childish or decorative.

The parent and child experiences share one design foundation. Parent pages prioritize efficient management and scanning. Child pages use the same structure with larger controls, child-specific accent colors, encouraging feedback, and simpler information density.

## 2. Design Thesis

Kids Tutor is a calm family learning studio built on a precise editorial grid, warm low-glare surfaces, clear information hierarchy, and small moments of child-friendly personality.

## 3. Current-Cycle Scope

This cycle implements Phase 1 and Phase 2 only.

### Phase 1: Foundation and App Shell

- Consolidate design tokens and typography roles.
- Introduce a consistent application shell and page header.
- Redesign parent navigation across desktop, tablet, and mobile.
- Redesign login, signup, and family homepage.
- Establish shared states for loading, empty, error, and confirmation UI.
- Remove recurring contrast failures and invalid nested interactive controls in touched pages.

### Phase 2: Parent Explorer Workspaces

- Redesign `ExplorerLayout` and `TreePanel`.
- Apply the explorer system to `/parent`, `/parent/exercises`, and `/parent/children`.
- Standardize list rows, toolbars, search, filters, selection, and bulk actions.
- Keep exercise items out of the tree; the tree contains subjects and age groups only.
- Keep child avatars out of tree navigation; child details display the avatar in the workspace.

## 4. Deferred Scope

The following work is designed here for consistency but deferred to a later cycle:

- Phase 3: child dashboard and one-question-at-a-time exercise player.
- Phase 4: upload, exercise review, AI settings, and remaining management pages.
- Phase 5: full automated visual regression coverage and performance optimization.
- Local AI presets for Ollama, vLLM, and OpenWebUI.
- Backend schema or API behavior changes unrelated to the redesign.

## 5. Product Principles

1. One dominant action per view.
2. Use hierarchy, alignment, and whitespace before adding containers.
3. Cards represent real content groups, not every section or list row.
4. State is never communicated by color alone.
5. Dark surfaces always use high-contrast light text; dark text appears on light surfaces.
6. Brand moss and semantic success green are separate roles.
7. Mobile layouts are recomposed around priority instead of shrinking desktop layouts.
8. Children receive warmth through avatars, accent colors, progress, and language rather than visual clutter.

## 6. Visual System

### Color Roles

- Page background: low-glare mineral gray-green.
- Primary surface: warm off-white.
- Secondary surface: pale neutral green-gray.
- Primary ink: very dark green-black.
- Muted ink: medium neutral green-gray with WCAG AA contrast.
- Brand accent: deep moss for primary actions, active navigation, and key emphasis.
- Brand accent soft: pale moss for selected and hover states.
- Supporting child accents: muted marigold, coral, and sky blue.
- Success, warning, error, and information colors remain semantically distinct.

Every token must define usable foreground/background pairs for default, hover, active, focus, and disabled states. Avoid selectors that infer contrast from arbitrary parent backgrounds.

### Typography

Continue using a Thai-capable sans-serif stack centered on Sarabun.

- Page title: 30-32px, strong weight, compact line height.
- Section heading: 20-22px.
- Component heading: 16-18px.
- Body: 15-16px.
- Metadata and labels: 12-14px, never below accessible contrast.
- Technical values only: monospace where appropriate.

Use weight and spacing before introducing additional font sizes. Do not scale type directly with viewport width.

### Geometry

- Shared spacing scale based on 4px increments.
- Default component radius: 8px.
- Large grouped surfaces: up to 10px.
- Borders: quiet 1px neutral rules.
- Shadows: subtle for raised surfaces; stronger shadows only for dialogs and temporary overlays.
- Touch targets: at least 44px; child answer controls at least 48px.

## 7. Layout System

### Global Container

- Maximum content width: 1280px.
- Consistent outer gutters across navigation, headings, explorer panels, and content.
- Page title, tree edge, and workspace edge align to shared grid tracks.

### Parent Desktop

- Top application bar for global sections.
- Explorer pages use a fixed 260-280px tree and a flexible workspace.
- Page headings place title and description on the left and the primary action on the right.
- List content uses rows and dividers inside one grouped surface.

### Tablet

- Landscape may retain the two-pane explorer with a narrower tree.
- Portrait switches the tree to a collapsible navigation panel above the workspace.
- Header actions wrap as a coherent control group instead of compressing labels.

### Mobile

- Minimum supported width: 360px.
- Compact top bar contains family identity and account actions.
- Bottom navigation exposes Home, Exercises, Children, and More.
- Upload, AI settings, and data management live under More.
- Explorer navigation becomes a full-width temporary panel and closes after selection.
- The workspace appears before secondary navigation in reading order where appropriate.

## 8. Navigation

### Desktop and Tablet Landscape

- Use icon plus text labels.
- Active navigation uses a pale moss surface with dark text.
- Hover and focus retain readable contrast.
- Logout is visually secondary and separated from primary navigation.

### Mobile

- Use a stable bottom navigation for frequent destinations.
- Provide visible labels with icons.
- Respect safe-area insets.
- Do not use horizontal scrolling as the main navigation pattern.

## 9. Core Components

### AppShell

Owns global navigation, responsive transformations, family identity, and the primary content container. It does not own route data.

### PageHeader

Owns title, description, breadcrumb/context, and one primary action. Secondary actions live in a toolbar or overflow menu.

### ExplorerLayout

Owns two-pane layout on wide screens and temporary tree navigation on narrow screens. It preserves workspace state when the tree opens or closes.

### TreePanel

- Default rows use transparent or warm-white surfaces with dark text.
- Hover uses pale moss.
- Selection uses pale moss plus a narrow left indicator.
- Counts use neutral light badges with dark text.
- Indentation reduces available width so right edges remain aligned.
- Tree labels truncate gracefully and expose the full label accessibly.
- No dark green block rows.

### DataToolbar

Combines search, filters, selection count, and bulk actions. Destructive actions appear only when a selection exists and require confirmation.

### EntityList

Provides consistent exercise, child, and storage rows. Each row has a clear title region, metadata region, status region, and optional selection control. Per-row delete buttons are avoided when bulk actions exist.

### ProgressMeter

Uses a neutral track, contrasting fill, visible text value, and accessible progress semantics. It never places green text and green progress on a green panel.

### StatusBadge

Combines label, icon, and semantic color. Badge colors use tested foreground/background pairs.

### Shared States

`LoadingState`, `EmptyState`, and `ErrorState` reserve stable dimensions. Empty states provide one clear next action. Errors state what happened and what the user can do next.

## 10. Route Composition

### Login and Signup

- Use the same brand foundation as the family workspace.
- Add persistent labels for all fields; placeholders are examples only.
- Use one primary submit action and a styled secondary route link.
- Provide clear busy, validation, and authentication error states.
- Remove inline layout styling and default browser-blue links.

### Family Homepage

- Use light profile tiles with large avatars and safe text wrapping.
- Apply child accent colors as small edges, rings, or pale tints rather than saturated tile backgrounds.
- Keep the parent tile equal in size but visually distinct through iconography and copy.
- Avoid links wrapping buttons; each tile is one semantic interactive element.

### Parent Overview

- Lead with family identity and a small set of meaningful totals.
- Use the tree for management sections and the workspace for the selected section.
- Avoid card nesting; repeated family or storage data uses rows and dividers.

### Exercise Management

- Tree hierarchy: subject, then age group.
- Exercise items remain in the workspace list.
- Workspace header shows selected context and summary.
- Toolbar contains search, status filter, selection, and bulk actions.
- Rows prioritize exercise title, subject/age metadata, question count, status, and assignment count.
- Selecting an exercise preserves list position and opens its relevant detail workflow.

### Children Management

- Tree contains child names without avatars.
- Workspace header displays the selected child's avatar, name, and age group.
- Progress, assignments, and profile settings use clearly separated sections in one workspace.
- Child-specific accent color is decorative support and never carries required meaning.

## 11. Interaction and Error Handling

- Use toasts for normal success and recoverable errors.
- Use dialogs for destructive actions, credential changes, and cost consent.
- Dialogs restore focus to the originating control when closed.
- Bulk deletion shows item count and describes the impact.
- Loading controls remain disabled without changing width.
- Network errors preserve user-entered values where possible.
- Empty, loading, and error states must not cause major layout shifts.

## 12. Accessibility

- Meet WCAG AA contrast for text and interactive states.
- Use semantic landmarks, headings, lists, links, and buttons.
- Provide labels for every form control.
- Remove nested interactive elements.
- Provide visible `:focus-visible` treatment.
- Use `aria-current` for active navigation.
- Use accessible progress semantics and descriptive status text.
- Support keyboard interaction and browser zoom.
- Respect `prefers-reduced-motion`.

## 13. Implementation Boundaries

- Preserve existing route behavior and APIs during Phase 1-2.
- Keep React, React Router, Radix Themes, and Lucide.
- Prefer shared components and tokens over route-specific overrides.
- Split the monolithic stylesheet into foundation, shared component, parent workspace, child experience, and print layers.
- Avoid a broad component rewrite outside touched routes.
- Do not include unrelated backend refactors.

## 14. Verification

Phase 1-2 is complete when:

- Existing unit and route tests pass.
- TypeScript and production build pass.
- Production smoke tests pass after deployment.
- Desktop, tablet, and mobile layouts are manually verified at 1440, 1024, 768, and 390px.
- Login, signup, family homepage, parent overview, exercises, and children pages have no horizontal overflow.
- Keyboard navigation and visible focus are verified on touched pages.
- Contrast is checked for default, hover, selected, disabled, success, warning, and error states.
- Long Thai and English labels do not overlap or push controls outside their containers.

## 15. Success Criteria

- Parents can identify the primary action and current context within a few seconds.
- Exercise and child management remain usable as data volume grows.
- Children recognize their profile and next exercise without reading dense metadata.
- The interface feels like one coherent family product across parent and child routes.
- Repeated dark-text-on-dark-green and green-on-green failures are eliminated by token design rather than one-off patches.
- The redesigned foundation can support the deferred child player, upload, review, and AI work without creating a second visual system.
