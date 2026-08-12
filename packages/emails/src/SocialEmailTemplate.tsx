import { Button, Heading, Section, Text } from '@react-email/components'
import {
  lightColorTokens,
  radiusScale,
  spacingScale,
  typographyScale
} from '@artificer-toolkit/design-system'
import type { CSSProperties } from 'react'

import { BrandedEmailFrame } from './BrandedEmailFrame.js'
import type { SocialEmailContent } from './socialEmailContent.js'

export function SocialEmail({ content }: { content: SocialEmailContent }) {
  return (
    <BrandedEmailFrame preferencesUrl={content.preferencesUrl} preview={content.preview}>
      <Section style={styles.content}>
        <Heading as='h2' style={styles.heading}>
          {content.title}
        </Heading>
        <Text style={styles.copy}>{content.body}</Text>
        <Button href={content.actionUrl} style={styles.button}>
          {content.actionLabel}
        </Button>
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
  }
}
