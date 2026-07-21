import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text
} from '@react-email/components'
import {
  lightColorTokens,
  radiusScale,
  spacingScale,
  typographyScale
} from '@artificer-toolkit/design-system'
import type { CSSProperties } from 'react'

import { getAuthEmailContent, type AuthEmailProps } from './authEmailContent.js'

export function AuthEmail({ action, actionUrl, token }: AuthEmailProps) {
  const content = getAuthEmailContent(action)

  return (
    <Html lang='en'>
      <Head />
      <Preview>{content.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brand}>
            <Text style={styles.brandEyebrow}>ARTIFICER TOOLKIT</Text>
            <Heading as='h1' style={styles.brandTitle}>
              Forge clarity. Reliable play.
            </Heading>
          </Section>
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
          <Section style={styles.footer}>
            <Text style={styles.footerText}>Artificer Toolkit</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const colors = lightColorTokens.color

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: colors.surface.canvas,
    color: colors.text.primary,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
    margin: '0',
    padding: `${spacingScale[8]}rem ${spacingScale[3]}rem`
  },
  container: {
    backgroundColor: colors.surface.panel,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: `${radiusScale.lg}px`,
    margin: '0 auto',
    maxWidth: '600px',
    overflow: 'hidden'
  },
  brand: {
    backgroundColor: colors.accent.solid,
    color: colors.accent.contrast,
    padding: `${spacingScale[7]}rem ${spacingScale[6]}rem`
  },
  brandEyebrow: {
    fontSize: `${typographyScale.label.fontSize}rem`,
    fontWeight: typographyScale.label.fontWeight,
    letterSpacing: '0.12em',
    lineHeight: typographyScale.label.lineHeight,
    margin: '0 0 8px',
    textTransform: 'uppercase'
  },
  brandTitle: {
    color: colors.accent.contrast,
    fontSize: `${typographyScale.heading.fontSize}rem`,
    fontWeight: typographyScale.heading.fontWeight,
    lineHeight: typographyScale.heading.lineHeight,
    margin: '0'
  },
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
    padding: '14px 20px',
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
  },
  footer: {
    borderTop: `1px solid ${colors.border.subtle}`,
    padding: `16px ${spacingScale[6]}rem`
  },
  footerText: {
    color: colors.text.muted,
    fontSize: `${typographyScale.caption.fontSize}rem`,
    margin: '0'
  }
}
