# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkyDash Bank is a Bootstrap 4 admin dashboard template (based on BootstrapDash) customized for a banking application. It is a static HTML/CSS/JS project with no backend — all interactivity is frontend-only using jQuery and plugin libraries.

## Development Commands

**Install dependencies** (run once after cloning):
```bash
npm install
```

**Start development server** (SCSS compilation + BrowserSync live reload on port 3000):
```bash
gulp serve
```

**Start lite server** (no SCSS compilation, watches CSS/HTML/JS only):
```bash
gulp serve:lite
```

**Compile SCSS only** (outputs to `css/`):
```bash
gulp sass
```

**Rebuild vendor bundles** (after adding/updating npm packages):
```bash
gulp bundleVendors
```

**Inject HTML partials and assets into all HTML files**:
```bash
gulp inject
```

There are no tests configured in this project.

## Architecture

### Build System
Gulp 4 orchestrates everything:
- **SCSS → CSS**: `scss/**/style.scss` compiles to `css/` with sourcemaps
- **Vendor bundling**: npm packages are copied/concatenated into `vendors/` (do not edit `vendors/` manually — regenerate with `gulp bundleVendors`)
- **HTML partials injection**: `gulp-inject-partials` inlines `partials/_navbar.html`, `partials/_sidebar.html`, `partials/_footer.html`, and `partials/_settings-panel.html` into every page via HTML comments like `<!-- inject:partials/... -->`
- **Asset injection**: `gulp-inject` automatically inserts `<script>` and `<link>` tags into HTML

### HTML Structure
Pages use injection markers for shared components. When editing shared navigation or sidebar items, edit the files in `partials/` and run `gulp inject` to propagate changes.

Pages are organized as:
- `index.html` — main dashboard
- `pages/charts/` — chart demos
- `pages/forms/` — form component demos
- `pages/tables/` — table demos
- `pages/ui-features/` — UI kit demos
- `pages/samples/` — auth pages (login, register, error pages)
- `pages/icons/` — icon showcase

### Styling
- Source: `scss/` (edit here, never edit `css/` directly)
- `scss/vertical-layout-light/` — layout-specific styles (sidebar, navbar, wrapper)
- `scss/common/light/` and `scss/common/dark/` — theme variants
- Each subdirectory mirrors the component structure (components, mixins, plugin-overrides, etc.)
- The compiled output is `css/vertical-layout-light/style.css`

### JavaScript
All JS is plain jQuery-based, loaded via `<script>` tags. Core files loaded on every page (via `gulp injectCommonAssets`):
- `js/template.js` — sidebar active states, navigation
- `js/off-canvas.js` — mobile drawer
- `js/hoverable-collapse.js` — collapsible sidebar menus
- `js/settings.js` — settings panel (theme/layout toggles)
- `js/todolist.js` — todo widget

Page-specific plugin initializers live in `js/` (e.g., `js/dashboard.js`, `js/chart.js`, `js/data-table.js`) and are included only on pages that need them.

### Asset Path Convention
Because pages sit at different depths (`/index.html` vs `/pages/charts/chartjs.html`), the `gulp replacePath` task rewrites relative paths after injection. This means asset paths in partials use root-relative-style references that get rewritten per directory depth.
