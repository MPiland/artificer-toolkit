import { Button, Heading, Section, Text } from '@react-email/components'
import {
  lightColorTokens,
  radiusScale,
  spacingScale,
  typographyScale
} from '@artificer-toolkit/design-system'
import type { CSSProperties } from 'react'

import { BrandedEmailFrame } from './BrandedEmailFrame.js'
import { getAuthEmailContent, type AuthEmailProps } from './authEmailContent.js'

export function AuthEmail({ action, actionUrl, token }: AuthEmailProps) {
  const content = getAuthEmailContent(action)

  return (
    <BrandedEmailFrame preview={content.preview}>
      <Section style={styles.content}>
        <Heading as='h2' style={styles.heading}>
          {content.title}
        </Heading>
        <Text style={styles.copy}>{content.body}</Text>
        {actionUrl && content.actionLabel ? (
          <Button href={actionUrl} style={styles.button}>
            {content.actionLabel}
          </Button>
        ) : null}
        {token && content.includeToken ? (
          <Section style={styles.codeSection}>
            <Text style={styles.codeLabel}>Verification code</Text>
            <Text style={styles.code}>{token}</Text>
          </Section>
        ) : null}
        <Text style={styles.securityNote}>{content.securityNote}</Text>
      </Section>
    </BrandedEmailFrame>
  )
}

const colors = lightColorTokens.color

const styles: Record<string, CSSProperties> = {
  content: {
    padding: `${spacingScale[7]}rem ${spacingScale[6]}rem`
  },
  heading: {
    color: colors.text.primary,
    fontSize: `${typographyScale.heading.fontSize}rem`,
    fontWeight: typographyScale.heading.fontWeight,
    lineHeight: typographyScale.heading.lineHeight,
    margin: '0 0 16px'
  },
  copy: {
    color: colors.text.secondary,
    fontSize: `${typographyScale.body.fontSize}rem`,
    lineHeight: typographyScale.body.lineHeight,
    margin: '0 0 24px'
  },
  button: {
    backgroundColor: colors.button.primary.background,
    borderRadius: `${radiusScale.md}px`,
    color: colors.button.primary.text,
    display: 'inline-block',
    fontSize: `${typographyScale.bodySm.fontSize}rem`,
    fontWeight: typographyScale.label.fontWeight,
    lineHeight: '1',
    padding: '15px 20px',
    textDecoration: 'none'
  },
  codeSection: {
    backgroundColor: colors.surface.subtle,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: `${radiusScale.md}px`,
    marginTop: '24px',
    padding: '16px'
  },
  codeLabel: {
    color: colors.text.secondary,
    fontSize: `${typographyScale.label.fontSize}rem`,
    fontWeight: typographyScale.label.fontWeight,
    margin: '0 0 8px',
    textTransform: 'uppercase'
  },
  code: {
    color: colors.text.primary,
    fontFamily: "'SFMono-Regular', 'SF Mono', 'JetBrains Mono', monospace",
    fontSize: '1.25rem',
    fontWeight: typographyScale.heading.fontWeight,
    letterSpacing: '0.08em',
    margin: '0'
  },
  securityNote: {
    color: colors.text.muted,
    fontSize: `${typographyScale.bodySm.fontSize}rem`,
    lineHeight: typographyScale.bodySm.lineHeight,
    margin: '24px 0 0'
  }
}
