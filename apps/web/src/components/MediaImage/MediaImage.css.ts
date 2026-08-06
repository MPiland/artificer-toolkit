import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const control = style({
  '@layer': {
    [app]: { display: 'inline-flex', alignItems: 'center', gap: foundationVars.space[2] }
  }
})

export const image = style({
  '@layer': { [app]: { display: 'block', width: '100%', height: '100%', objectFit: 'cover' } }
})

export const avatar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      width: '3.25rem',
      height: '3.25rem',
      placeItems: 'center',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: '50%',
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.muted
    }
  }
})

export const portrait = style({
  '@layer': {
    [app]: {
      display: 'grid',
      width: '100%',
      height: '100%',
      placeItems: 'center',
      overflow: 'hidden',
      borderRadius: 'inherit',
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.muted
    }
  }
})

export const portraitTriggerWrapper = style({
  '@layer': { [app]: { display: 'block', width: '100%', height: '100%' } }
})

export const portraitTrigger = style({
  '@layer': {
    [app]: {
      display: 'block',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      borderRadius: 'inherit',
      ':focus-visible': { outline: 'none', boxShadow: foundationVars.shadow.focus }
    }
  }
})

export const artworkTrigger = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'grid',
      width: '5rem',
      height: '5rem',
      placeItems: 'center',
      overflow: 'hidden',
      border: `1px dashed ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.muted,
      cursor: 'pointer',
      transition: 'border-color 120ms ease, background-color 120ms ease, color 120ms ease',
      ':hover': {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.accent.soft,
        color: foundationVars.color.accent.solid
      },
      ':focus-visible': { outline: 'none', boxShadow: foundationVars.shadow.focus },
      ':disabled': { cursor: 'not-allowed', opacity: 0.55 }
    }
  }
})

export const artworkTriggerFilled = style({
  '@layer': { [app]: { borderStyle: 'solid' } }
})

export const artworkEditBadge = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      right: foundationVars.space[1],
      bottom: foundationVars.space[1],
      display: 'grid',
      width: '1.5rem',
      height: '1.5rem',
      placeItems: 'center',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.primary
    }
  }
})

export const dialogBody = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[4] } }
})

export const preview = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minHeight: '14rem',
      placeItems: 'center',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const previewImage = style({
  '@layer': {
    [app]: { display: 'block', maxWidth: '100%', maxHeight: '24rem', objectFit: 'contain' }
  }
})

export const detailImage = style({
  '@layer': {
    [app]: {
      display: 'block',
      justifySelf: 'center',
      maxWidth: '100%',
      maxHeight: '36rem',
      marginBlock: foundationVars.space[4],
      objectFit: 'contain'
    }
  }
})

export const inspectorImage = style({
  '@layer': {
    [app]: {
      display: 'block',
      width: 'calc(100% - 2rem)',
      maxHeight: '14rem',
      margin: `0 ${foundationVars.space[4]} ${foundationVars.space[3]}`,
      borderRadius: foundationVars.radius.md,
      objectFit: 'contain'
    }
  }
})

export const actions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      justifyContent: 'space-between'
    }
  }
})

export const liveMessage = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})

export const cropLabel = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})
