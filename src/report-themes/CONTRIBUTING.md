# Contributing Themes

This doc covers how to add or update report themes.

## Create a theme
1. Copy an existing theme JSON file in this directory (for example `minimal.json`).
2. Rename it to a new lowercase, kebab-case filename.
3. Set `"layout"` to one of:
   - `minimal` for the simple single-column layout
   - `hud` for the neon/gamified layout
4. Update the token values.

The theme name is the filename without `.json`. For example: `minimal.json` -> `minimal`.

## Layout expectations
Each layout expects different visual emphases:

- `minimal`: clean, quiet, single-column layout. Avoid heavy glow, noisy patterns, or neon colors.
- `hud`: bold, neon, gamified layout. Strong accents, glow, and high contrast are expected.

## Token guidance
All themes share the same token set. Follow these rules:

- Keep `ink` readable on `bg` and `bgCard`.
- `grid` and `axis` should be subtle but visible on charts.
- `border` should be visible on cards without overpowering content.
- `shadow` should match the theme’s density (soft for minimal, punchy for hud).

Suggested starting points:
- For minimal: reduce saturation and keep `gridLine`, `scanline`, and `cardGlow` subtle.
- For hud: increase contrast and consider stronger `titleGlow`, `sectionGlow`, and `cardGlow`.

## Quick local test
After editing a theme, rebuild the report and open it:

```bash
npx @gfdlr/lighthouse-metrics report --set report.theme=<your-theme>
npx @gfdlr/lighthouse-metrics serve --open
```

## Common pitfalls
- Missing `"layout"`: the layout defaults based on theme name, which may be wrong for custom themes.
- Low contrast chart text: check `axis`, `grid`, and legend colors.
- Over-strong shadows: a heavy `shadow` can reduce legibility on dense charts.

## Review checklist
- Layout renders without overlap at common widths.
- Text contrast is readable on cards and charts.
- Charts (grid/axis/legend) remain legible.
- No missing tokens (stick to the existing token list).

## Screenshots
Include at least one screenshot per theme change in your PR.
