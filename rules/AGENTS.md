# CSV Viewing in Side Panel

Whenever you generate, create, export, build, or reference a CSV, TSV, or tabular data file:

1. **Always provide a clickable link to open the CSV directly in the side panel** using the `sidecar://` scheme:
   ```markdown
   [Open <filename>.csv in Side Panel](sidecar://csv-viewer/panel/?file=<encoded_path>)
   ```
   *(Pass the absolute path or workspace path in the `?file=` query parameter. If the path contains spaces or parentheses, URL-encode them — e.g. `%20`, `%28`, `%29` — so markdown parsers do not truncate the link).*

2. **Display this link prominently** in your response right after creating or modifying any CSV/TSV, allowing the user to click it and inspect the rendered dataset in the side pane immediately.
