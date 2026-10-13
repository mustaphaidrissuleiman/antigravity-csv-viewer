---
name: csv-viewer
description: Open, preview, and inspect CSV, TSV, or tabular data files in the side panel. Trigger when the user wants to view, open, inspect, or analyze a CSV or TSV file.
---

# CSV Viewer in Side Panel

Whenever the user asks to view, open, inspect, or display a CSV or TSV dataset:

1. Surface the clickable sidecar pill to open the CSV in the Auxiliary Side Panel:
   - For a specific file:
     `[Open <filename>.csv in Side Panel](sidecar://csv-viewer/panel/?file=<encoded_path>)`
     *(Ensure paths with spaces or parentheses are URL-encoded, e.g. `%20`)*
   - For the general CSV Viewer:
     `[Open CSV Viewer](sidecar://csv-viewer/panel/)`

2. Display the link prominently so the user can open it with a single click.
