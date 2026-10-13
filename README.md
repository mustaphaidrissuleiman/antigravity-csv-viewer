# CSV Viewer UI Extension for Antigravity

An interactive visual CSV, TSV, and tabular data viewer that renders directly in the Antigravity side panel (Auxiliary Pane).

![CSV Viewer Logo](assets/logo.svg)

## Features

- **Side Panel Integration:** Renders smoothly in the right-hand auxiliary pane alongside your conversations (`sidecar://csv-viewer/panel/?file=<path>`).
- **Delimiter Auto-Detection:** Automatically sniffs or lets you manually switch delimiters (comma `,`, tab `\t`, semicolon `;`, pipe `|`).
- **Interactive Data Table:**
  - Sticky header row and sticky row index column (`#`)
  - Sort columns in ascending, descending, or original order with numerical/date-aware sorting
  - Toggle first row as header on/off
  - Real-time search across all columns with match highlighting
  - Null / missing value indicators
- **Pagination & Virtualization:**
  - Fast rendering for small and large datasets alike
  - Configurable page sizes (25, 50, 100, 250, 500, All)
  - Quick page navigation
- **Dataset & Column Statistics:**
  - Inferred column data types (Number, String, Boolean, Date)
  - Missing and null value counts and percentages
  - Distinct value counts
  - Numeric metrics (Min, Max, Mean, Sum)
- **Agent Collaboration:**
  - Integrated "Ask Agent" drawer connected to the conversation
  - One-click prompt shortcuts (key takeaways, Python plotting scripts, data quality checks, statistical distributions)
  - Previews dataset schema and first 5 rows in Markdown format automatically
- **File Management & Discovery:**
  - Automatically indexes and discovers `.csv`, `.tsv`, and `.dsv` files across your workspace and scratch folders
  - Drag-and-drop any CSV or TSV file directly into the pane
  - File picker for local files
- **Export & Copy:**
  - Copy filtered or sorted dataset directly as CSV or JSON
  - Download dataset as CSV or JSON
- **Self-Contained & Offline:** Bundles PapaParse locally with zero external CDN dependencies.
- **Theme Aware:** Automatically matches Antigravity light and dark themes using host design tokens.

## Installation

### Method 1: Global User Plugin (Recommended)

Clone or copy this repository into your Antigravity plugins directory:

- **macOS / Linux:**
  ```bash
  git clone git@github.com:mustaphaidrissuleiman/antigravity-csv-viewer.git ~/.gemini/config/plugins/csv-viewer
  ```
- **Windows (PowerShell):**
  ```powershell
  git clone git@github.com:mustaphaidrissuleiman/antigravity-csv-viewer.git "$env:USERPROFILE\.gemini\config\plugins\csv-viewer"
  ```

### Method 2: Project / Team Workspace Customization

To share the viewer automatically with team members in a specific project or Git repository, copy the folder to `.agents/plugins/`:

```bash
mkdir -p .agents/plugins
cp -r /path/to/csv-viewer .agents/plugins/csv-viewer
git add .agents/plugins/csv-viewer
git commit -m "Add Antigravity CSV Viewer extension"
```

Anyone opening the workspace in Antigravity will have the extension available automatically.

## Usage

1. Open Antigravity and go to **Customizations > Installed** in the left sidebar.
2. Ensure **CSV Viewer** is enabled.
3. In any conversation, click the **⋮** menu in the top-right corner, select **Extensions**, and choose **CSV Viewer**.
4. Or open it via deep-link: `[Open CSV Viewer](sidecar://csv-viewer/panel/)`.

## Agent Deep-Linking Rule

Whenever an agent generates or references a CSV, it automatically provides a clickable pill to view it in the side panel:
```markdown
[Open data.csv in Side Panel](sidecar://csv-viewer/panel/?file=/path/to/data.csv)
```

## License

MIT © 2026 Mustapha Idris Suleiman
