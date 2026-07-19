import type {
  ActionAppearance,
  ActionEmphasis,
  ActionPresentation,
  ControlDensity,
  PresentationContext,
  ResponsivePresentation,
  SemanticSurfaceAppearance,
  SemanticSurfacePresentation,
  SemanticSurfaceRole,
  SemanticTextAppearance,
  SemanticTextPresentation,
  SemanticTextStyle,
  SemanticTextTone
} from '@artificer-toolkit/design-system'
import type { ButtonProps } from '@mantine/core'
import type { CSSProperties } from 'react'
import { foundationVars } from '../../css/foundations.css'

type ActionEmphasisAdapter = {
  variant: ButtonProps['variant']
}

/** Exhaustive web mapping from platform-neutral action priority to Mantine presentation. */
export const actionEmphasisAdapter = {
  primary: { variant: 'filled' },
  secondary: { variant: 'default' },
  quiet: { variant: 'subtle' }
} as const satisfies Record<ActionEmphasis, ActionEmphasisAdapter>

/** Exhaustive web mapping from portable density to labeled and icon control sizes. */
export const actionDensityAdapter = {
  compact: { button: 'xs', icon: 'md' },
  comfortable: { button: 'sm', icon: 'lg' }
} as const satisfies Record<ControlDensity, { button: ButtonProps['size']; icon: string }>

/** Exhaustive web typography recipes for future Authoring Schema presentation variants. */
export const authoringTextStyleAdapter = {
  title: foundationVars.typography.title,
  heading: foundationVars.typography.heading,
  body: foundationVars.typography.body,
  label: foundationVars.typography.label,
  supporting: foundationVars.typography.bodySm,
  value: foundationVars.typography.heading,
  caption: foundationVars.typography.caption
} as const satisfies Record<SemanticTextStyle, (typeof foundationVars.typography)[keyof typeof foundationVars.typography]>

/** Exhaustive web color mapping for schema-selected text tone. */
export const authoringTextToneAdapter = {
  primary: foundationVars.color.text.primary,
  secondary: foundationVars.color.text.secondary,
  muted: foundationVars.color.text.muted,
  accent: foundationVars.color.text.accent,
  critical: foundationVars.color.status.danger
} as const satisfies Record<SemanticTextTone, string>

/** Exhaustive web recipe mapping for schema-selected surface intent. */
export const authoringSurfaceAdapter = {
  transparent: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderStyle: 'solid',
    borderWidth: 0
  },
  panel: {
    backgroundColor: foundationVars.color.surface.panel,
    borderColor: foundationVars.color.border.subtle,
    borderRadius: foundationVars.radius.lg,
    borderStyle: 'solid',
    borderWidth: 1
  },
  raised: {
    backgroundColor: foundationVars.color.surface.raised,
    borderColor: foundationVars.color.card.border.default,
    borderRadius: foundationVars.radius.lg,
    borderStyle: 'solid',
    borderWidth: 1
  },
  recessed: {
    backgroundColor: foundationVars.color.surface.recessed,
    borderColor: foundationVars.color.border.subtle,
    borderRadius: foundationVars.radius.lg,
    borderStyle: 'solid',
    borderWidth: 1
  },
  selected: {
    backgroundColor: foundationVars.color.surface.emphasized,
    borderColor: foundationVars.color.accent.emphasisBorder,
    borderRadius: foundationVars.radius.lg,
    borderStyle: 'solid',
    borderWidth: 1
  }
} as const satisfies Record<SemanticSurfaceRole, CSSProperties>

/** Resolves a portable presentation against the current platform layout context. */
export function resolveActionAppearance(
  presentation: ActionPresentation,
  context: PresentationContext
): ActionAppearance {
  return resolveResponsivePresentation(presentation, context)
}

export function resolveAuthoringTextStyle(
  presentation: SemanticTextPresentation | undefined,
  context: PresentationContext
): CSSProperties | undefined {
  if (!presentation) return undefined
  const appearance = resolveResponsivePresentation(presentation, context)
  return {
    ...authoringTextStyleAdapter[appearance.style],
    color: authoringTextToneAdapter[appearance.tone]
  }
}

export function resolveAuthoringSurfaceStyle(
  presentation: SemanticSurfacePresentation | undefined,
  context: PresentationContext
): CSSProperties | undefined {
  if (!presentation) return undefined
  const appearance = resolveResponsivePresentation(presentation, context)
  return authoringSurfaceAdapter[appearance.role]
}

function resolveResponsivePresentation<
  TAppearance extends ActionAppearance | SemanticTextAppearance | SemanticSurfaceAppearance
>(
  presentation: ResponsivePresentation<TAppearance>,
  context: PresentationContext
): TAppearance {
  if (context === 'compact') return presentation.compact ?? presentation.default
  if (context === 'wide') return presentation.wide ?? presentation.default
  return presentation.default
}
