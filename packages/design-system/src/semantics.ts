/** Structural shape of an action control. Concrete components remain platform-owned. */
export const actionDisplay = ['icon', 'text', 'button'] as const
export type ActionDisplay = (typeof actionDisplay)[number]

/** Visual priority of an action without prescribing a color or component variant. */
export const actionEmphasis = ['primary', 'secondary', 'quiet'] as const
export type ActionEmphasis = (typeof actionEmphasis)[number]

/** Available-width intent for an action control. */
export const actionWidth = ['content', 'full'] as const
export type ActionWidth = (typeof actionWidth)[number]

/** Control density. Platform adapters remain responsible for accessible target sizes. */
export const controlDensity = ['compact', 'comfortable'] as const
export type ControlDensity = (typeof controlDensity)[number]

/** Platform-neutral responsive contexts selected by each platform adapter. */
export type PresentationContext = 'compact' | 'regular' | 'wide'

/** A complete default recipe with optional complete compact and wide overrides. */
export type ResponsivePresentation<TAppearance> = {
  default: TAppearance
  compact?: TAppearance
  wide?: TAppearance
}

type ActionAppearanceBase = {
  emphasis: ActionEmphasis
  density: ControlDensity
}

/** Icon-only actions cannot claim full-row width. */
export type IconActionAppearance = ActionAppearanceBase & {
  display: 'icon'
  width: 'content'
}

/** Complete labeled-action appearance at one responsive context. */
export type LabeledActionAppearance = ActionAppearanceBase & {
  display: 'text' | 'button'
  width: ActionWidth
}

/** Complete action appearance at one responsive context. */
export type ActionAppearance = IconActionAppearance | LabeledActionAppearance

/**
 * Responsive action intent. `default` is used in regular contexts; compact and wide are optional
 * complete overrides. Context names deliberately describe available layout, not device classes.
 */
export type ActionPresentation = ResponsivePresentation<ActionAppearance>

/** Portable presets for the common authoring action presentations. */
export const actionAppearancePresets = {
  icon: {
    display: 'icon',
    emphasis: 'quiet',
    width: 'content',
    density: 'compact'
  },
  text: {
    display: 'text',
    emphasis: 'quiet',
    width: 'content',
    density: 'compact'
  },
  button: {
    display: 'button',
    emphasis: 'secondary',
    width: 'content',
    density: 'compact'
  },
  primaryButton: {
    display: 'button',
    emphasis: 'primary',
    width: 'content',
    density: 'comfortable'
  }
} as const satisfies Record<string, ActionAppearance>

export const actionPresentationPresets = {
  icon: { default: actionAppearancePresets.icon },
  text: { default: actionAppearancePresets.text },
  button: { default: actionAppearancePresets.button }
} as const satisfies Record<'icon' | 'text' | 'button', ActionPresentation>

/** Typography recipes available to platform presentation adapters. */
export const semanticTextStyles = [
  'title',
  'heading',
  'body',
  'label',
  'supporting',
  'value',
  'caption'
] as const
export type SemanticTextStyle = (typeof semanticTextStyles)[number]

/** Text color intent. */
export const semanticTextTones = ['primary', 'secondary', 'muted', 'accent', 'critical'] as const
export type SemanticTextTone = (typeof semanticTextTones)[number]

/** Complete text recipe for a single presentation context. */
export type SemanticTextAppearance = {
  style: SemanticTextStyle
  tone: SemanticTextTone
}

export type SemanticTextPresentation = ResponsivePresentation<SemanticTextAppearance>

/** Container surface intent. Borders, shadows, and colors remain platform-owned recipes. */
export const semanticSurfaceRoles = [
  'transparent',
  'panel',
  'raised',
  'recessed',
  'selected'
] as const
export type SemanticSurfaceRole = (typeof semanticSurfaceRoles)[number]

/** Complete container recipe for a single presentation context. */
export type SemanticSurfaceAppearance = {
  role: SemanticSurfaceRole
}

export type SemanticSurfacePresentation = ResponsivePresentation<SemanticSurfaceAppearance>
