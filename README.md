<div align="center">

# NextJSON

### The Most Powerful JSON Formatter & Viewer for Chrome

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-v4.0-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore/detail/glmpfaiijaffmbihnkhneboblmkocnmj)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge&logo=googlechrome&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](#license)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-success?style=for-the-badge)](#architecture)

**Tree view. Graph visualization. Diff tool. JQ queries. 7 themes. Zero dependencies.**

[Install from Chrome Web Store](https://chrome.google.com/webstore/detail/glmpfaiijaffmbihnkhneboblmkocnmj) &nbsp;&middot;&nbsp; [Report Bug](../../issues) &nbsp;&middot;&nbsp; [Request Feature](../../issues)

---

</div>

## Why NextJSON?

Most JSON formatters stop at syntax highlighting. NextJSON is a **full-featured JSON IDE** in your browser — with a tree explorer, graph diagrams, a JQ query engine, diff comparison, inline editing, and six export formats. Built with pure vanilla JavaScript, no frameworks, no build step, no bloat.

## Features

### 6 View Modes

| View | Description |
|------|-------------|
| **Tree** | Hierarchical collapsible tree with syntax highlighting, keyboard navigation, and context menus |
| **Raw** | Pretty-printed or minified JSON with syntax coloring |
| **Graph** | Interactive node-link diagram (JSON Crack-style) with pan, zoom, and collapsible nodes |
| **Table** | Auto-converts arrays into sortable tabular format |
| **UI Preview** | Renders JSON as cards, forms, dashboards, timelines, or profile views |
| **Diff** | Side-by-side comparison showing additions, removals, and changes with path-level detail |

### Graph Visualization

Full interactive diagram engine — not an iframe or third-party embed.

- Hierarchical tree layout with Bezier curve edges
- Compact card nodes displaying up to 20 key-value pairs
- Color-coded by type: objects (purple), arrays (cyan), strings (green), numbers (blue), booleans (yellow), null (gray)
- Pan (click-drag), zoom (scroll wheel, 0.1x–3x), fit-to-view
- Click to inspect, double-click to collapse/expand branches
- Expand All / Collapse All controls

### UI Preview Engine

Automatically detects your data shape and renders it as a real UI:

- **Card View** — Product cards with images, prices, discount calculations, stock indicators, and tags
- **Form View** — Auto-grouped sections with text inputs, toggles, textareas, and image previews
- **Table View** — Columnar layout with inline thumbnails and URL detection
- **Dashboard View** — Stat cards with highlighted metrics and data-type summaries
- **Timeline View** — Chronological display with relative timestamps from auto-detected date fields
- **Profile View** — Avatar, name, role, company, location, contact details, and bio

### JQ-Lite Query Engine (60+ Functions)

A built-in JQ implementation — no external tools required.

```
.users[] | select(.active == true) | {name, email}
```

<details>
<summary><strong>Full function reference</strong></summary>

**Navigation** — `.`, `.foo.bar`, `.[0]`, `.[]`, `.[2:5]`, `..` (recursive descent)

**Array/Object** — `keys`, `values`, `length`, `reverse`, `sort`, `sort_by`, `group_by`, `unique`, `unique_by`, `flatten`, `first`, `last`, `min`, `min_by`, `max`, `max_by`, `add`, `any`, `all`, `limit`, `range`, `indices`, `inside`, `getpath`, `setpath`, `delpaths`, `to_entries`, `from_entries`, `with_entries`, `paths`, `leaf_paths`, `transpose`, `input`

**String** — `tostring`, `ascii_downcase`, `ascii_upcase`, `ltrimstr`, `rtrimstr`, `trim`, `split`, `join`, `test`, `match`, `capture`, `startswith`, `endswith`, `contains`, `explode`, `implode`, `gsub`, `sub`, `ascii`

**Math** — `floor`, `ceil`, `round`, `sqrt`, `abs`, `pow`, `log`, `fabs`, `nan`, `isinfinite`, `isnan`, `infinite`

**Type** — `type`, `tonumber`, `tostring`, `empty`, `null`, `true`, `false`, `not`, `builtins`

**Logic** — `select(cond)`, `map(expr)`, `map_values(expr)`, `recurse`, `env`, `now`, `debug`, `halt`, `error`

**Operators** — `==`, `!=`, `<`, `>`, `<=`, `>=`, `and`, `or`, `not`, `//` (alternative), `?//` (try)

**Construction** — `{key: .val}` objects, `[.[] | expr]` arrays, pipe chaining with `|`

</details>

### Search & Filter

- Full-text search across keys, values, or both
- Case-sensitive and regex pattern matching
- Match counter with Previous / Next navigation
- Auto-expands collapsed paths to reveal matches
- Path-based search (e.g., `.product.variants[].price`)

### Inline Editing

- Edit values in-place via right-click context menu
- Rename keys while preserving object order
- Add or delete keys and array items
- 50-level undo/redo stack (`Ctrl+Z` / `Ctrl+Y`)
- Intelligent type preservation (strings, numbers, booleans, null, objects, arrays)

### Export & Copy

**Export formats:**

| Format | Details |
|--------|---------|
| JSON | Formatted with indentation |
| CSV | Auto-flattened nested objects with dot notation |
| Excel (XLSX) | Native Office Open XML |
| YAML | Full conversion with proper indentation |
| TypeScript | Auto-generated interface definitions |
| Minified | Single-line compact output |

**Copy as:**
Raw JSON, Minified JSON, cURL command, JavaScript (ES6), Python dict, TypeScript interface

### Context Menu (Right-Click)

**Copy** — Path, JSONPath, JQ path, JavaScript path, Python path, Key, Value, Complete object

**Edit** — Edit value, Add key (inside/below), Delete

**Actions** — View as table, Search in Google, Highlight matching keys, Filter by key, Show data type

### 7 Built-in Themes

| Theme | Style |
|-------|-------|
| **Dark** | Default — dark background, bright syntax |
| **Light** | Clean light background with muted tones |
| **Monokai** | Warm editor classic |
| **Dracula** | Purple and pink accents |
| **Nord** | Arctic frost-inspired palette |
| **Solarized Dark** | Ethan Schoonover's precision palette |
| **GitHub Dark** | GitHub's official dark theme |

### Smart Detection

- Auto-formats `.json` files and API responses
- GraphQL response detection with `data`/`errors` tab separation
- Unix timestamp formatting (seconds and milliseconds) with relative time tooltips
- URL source tracking and breadcrumb navigation
- Import from URL with built-in CORS bypass

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Arrow Down/Up` | Navigate tree rows |
| `Arrow Right` | Expand node |
| `Arrow Left` | Collapse node |
| `Enter` / `Space` | Toggle expand/collapse |
| `Ctrl+F` | Focus search |
| `Ctrl+C` | Copy selected value |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+Plus` | Zoom in |
| `Ctrl+Minus` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `Escape` | Clear search / Close menus |

## Installation

### Chrome Web Store

[**Install NextJSON**](https://chrome.google.com/webstore/detail/glmpfaiijaffmbihnkhneboblmkocnmj) — one click, auto-updates.

### Manual (Developer Mode)

```bash
git clone https://github.com/AwaisdotCodes/NextJSON.git
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the cloned folder

## Usage

**Automatic** — Navigate to any `.json` URL or API endpoint. NextJSON activates automatically.

**Manual** — Click the extension icon, paste JSON, hit `Ctrl+Enter` or click **Format JSON**.

**From URL** — Use the URL import feature to fetch JSON from any endpoint (CORS handled automatically).

## Architecture

```
manifest.json          # Extension manifest (MV3)
js/
  background.js        # Service worker — CORS bypass via message passing
  content.js           # Content script — JSON page detection & redirect
  popup.js             # Popup UI for manual JSON input
  viewer.js            # Core application (3,400+ lines)
  tree-graph.js        # Graph visualization engine
  ui-renderer.js       # UI preview renderer (cards, forms, dashboards)
  jq-lite.js           # JQ/JSONPath query engine
css/
  viewer.css           # Main styles + 7 theme definitions
  graph.css            # Graph visualization styles
  ui-renderer.css      # UI preview component styles
html/
  viewer.html          # Main viewer page
  popup.html           # Extension popup
```

**Zero dependencies.** Pure vanilla JavaScript, no build tools, no npm, no transpilation. Every file loads directly in the browser.

## License

[MIT](LICENSE)

---

<div align="center">

**Built by [sourcelogs.com](https://sourcelogs.com)**

</div>
