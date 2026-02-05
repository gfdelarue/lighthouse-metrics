# Report Themes

Themes live in this directory as JSON files. Each theme is a full set of design tokens used by the report HTML/CSS.
Layouts live in `src/report-layouts/` and are selected by the theme `layout` field. See `src/report-layouts/README.md` for layout details.

## Add a theme
1. Copy an existing theme file (for example `minimal.json`).
2. Update the token values.
3. Set a layout:
   - `"layout": "minimal"` for the simple single-column layout
   - `"layout": "hud"` for the neon/gamified layout

## Use a theme
Set the report theme in your project config:

```json
{
  "report": {
    "theme": "your-theme-name"
  }
}
```

The CLI loads themes by filename (without the `.json` extension).
