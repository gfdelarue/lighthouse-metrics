# Contributing Layouts

This doc covers how to add or update report layouts.

## Create a layout
1. Copy an existing layout file in this directory (for example `minimal.cjs`).
2. Rename it to a new lowercase, kebab-case filename.
3. Implement `render(ctx)` and return `{ css, body }`.
4. Use `ctx.theme` for colors and styling tokens.

## Keep layouts theme-friendly
- Avoid hard-coded colors unless they are tokens from `ctx.theme`.
- Keep layout structure in the layout file, not in themes.
- Ensure charts and tables remain readable at common widths.

## Quick local test
```bash
npx @gfdlr/litehouse-metrics report --set report.theme=<theme-name>
npx @gfdlr/litehouse-metrics serve --open
```

## Review checklist
- Layout renders without overlap at common widths.
- Charts and tables are legible.
- Tokens drive colors and shadow treatments.
