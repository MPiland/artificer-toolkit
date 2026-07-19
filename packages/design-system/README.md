# @artificer-toolkit/design-system

Dependency-free foundation package for design-system and authoring-facing semantics.

## Scope

- Primitive numeric scales: spacing, radii, typography, motion, and breakpoints.
- String-based color primitives.
- Closed semantic vocabularies.
- Derived TypeScript types from readonly tuples.

This package intentionally contains no web, React, Vanilla Extract, CSS, or native UI concerns.
Adapters in `apps/web` (or future native packages) own CSS unit conversion and
component recipes. Font stacks, CSS shadows, media-query strings, browser focus
behavior, and product-specific layout widths remain platform-owned.

## Semantic presentation

Schemas describe intent; adapters choose components and tokens. For example, an action may be
quiet text in a regular workspace and a full-width primary control in a compact workspace:

```ts
const presentation: ActionPresentation = {
  default: actionAppearancePresets.text,
  compact: {
    ...actionAppearancePresets.primaryButton,
    width: 'full'
  }
}
```

`compact`, `regular`, and `wide` describe available layout, not web, tablet, mobile, or native
devices. A web adapter selects the context from its responsive layout; a future native adapter may
select the same context using different platform information.

The package also exports complete responsive text and surface recipes. Authoring groups may select
heading `SemanticTextPresentation` and container `SemanticSurfacePresentation`; web maps those to
the existing typography, color, border, and radius tokens. These remain node-kind-specific
contracts—not arbitrary style bags. Schemas must never expose raw colors, font weights, CSS
properties, component-library props, breakpoint numbers, or token paths.

## Exports

- `ActionPresentation`, `ActionAppearance`, `actionAppearancePresets`
- `ActionDisplay`, `ActionEmphasis`, `ActionWidth`, `ControlDensity`
- `PresentationContext = "compact" | "regular" | "wide"`
- `ResponsivePresentation<TAppearance>`
- `SemanticTextPresentation`, `SemanticTextStyle`, `SemanticTextTone`
- `SemanticSurfacePresentation`, `SemanticSurfaceRole`
- `SemanticVisualRole = "canvas" | "surface" | "text" | "border" | "focus" | "destructive" | "accent"`
- `spacingScale`, `radiusScale`, `typographyScale`, `motionScale`, `breakpoints`
- `fontWeightScale`, `lightColorTokens`, `darkColorTokens`, `brandColorScale`

## Notes

- Numeric scales are unitless and intended for adapter conversion.
- Colors are intentionally strings in this package so they can be mapped directly by
  platform runtimes or overridden by a design-theming layer.
- Invalid semantics are constrained by tuple-derived types. Each platform must provide
  its own exhaustive `Record<Semantic, Adapter>` mapping.
- Adding a semantic intentionally fails platform typechecks until every active adapter maps it.
  Existing schemas do not change unless they opt into the new semantic.
