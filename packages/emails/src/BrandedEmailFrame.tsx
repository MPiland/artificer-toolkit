import { Body, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components'
import {
  lightColorTokens,
  radiusScale,
  spacingScale,
  typographyScale
} from '@artificer-toolkit/design-system'
import type { CSSProperties, ReactNode } from 'react'

export function BrandedEmailFrame({
  children,
  preferencesUrl,
  preview
}: {
  children: ReactNode
  preferencesUrl?: string
  preview: string
}) {
  return (
    <Html lang='en'>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brand}>
            <Text style={styles.brandName}>Artificer Toolkit</Text>
          </Section>
          {children}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>Artificer Toolkit</Text>
            {preferencesUrl ? (
              <Text style={styles.preferencesText}>
                <Link href={preferencesUrl} style={styles.preferencesLink}>
                  Manage notification preferences
                </Link>
              </Text>
            ) : null}
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
  brandName: {
    color: colors.accent.contrast,
    fontSize: `${typographyScale.heading.fontSize}rem`,
    fontWeight: typographyScale.heading.fontWeight,
    lineHeight: typographyScale.heading.lineHeight,
    margin: '0'
  },
  footer: {
    borderTop: `1px solid ${colors.border.subtle}`,
    padding: `16px ${spacingScale[6]}rem`
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: `${typographyScale.caption.fontSize}rem`,
    margin: '0'
  },
  preferencesText: {
    fontSize: `${typographyScale.caption.fontSize}rem`,
    margin: '8px 0 0'
  },
  preferencesLink: {
    color: colors.text.accent,
    textDecoration: 'underline'
  }
}
