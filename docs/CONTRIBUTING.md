# Contributing

Thanks for helping improve litehouse-metrics! This guide covers how to contribute changes across the project.

## Basics
- Keep changes focused and scoped to a single purpose.
- Prefer small, reviewable commits.
- Update docs and tests when behavior changes.
- Avoid adding dependencies unless necessary.

## Development
- Run tests with:
  - `npm test`

## Report themes
Themes live in `src/report-themes/`. Each theme is a JSON file containing design tokens used by the report layout.
Layouts live in `src/report-layouts/` and control the report structure.

Guidelines:
- Keep tokens consistent with existing files.
- Ensure the theme works with the chosen layout (`minimal` or `hud`).
- Prefer readable contrasts and legible fonts.
- If a theme changes layout-specific values, note it in the theme README.

## Submitting changes
- Open a pull request with a clear summary of changes.
- Include screenshots for any UI changes to the report.
