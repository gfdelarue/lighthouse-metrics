# Report Layouts

Layouts live in this directory as `.cjs` modules. Each layout exports a `render(ctx)` function that returns `{ css, body }` for the report.

Layouts define structure and UX. Themes provide tokens that the layout uses for styling.

## Layout selection
A theme chooses a layout using the `layout` field in its JSON:

```json
{
  "layout": "minimal"
}
```

## Add a layout
1. Copy an existing layout file (for example `minimal.cjs`).
2. Rename it to a new lowercase, kebab-case filename.
3. Export a `render(ctx)` function that returns `{ css, body }`.
4. Use tokens from `ctx.theme` for color and styling.

## Context available to layouts
Layouts receive a context object with:
- `theme` (token map)
- `reportTitle`, `reportConfig`, `generatedStamp`
- Latest metrics values
- Charts HTML (`clocChart`, `coverageChart`, `passRateDurationChart`, `testCategoryChart`)
- Helpers (`formatNumber`, `formatDuration`, `formatDateShort`)

See `minimal.cjs` and `hud.cjs` for examples.
