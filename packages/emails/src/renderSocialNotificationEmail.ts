import { render } from '@react-email/render'
import { createElement } from 'react'

import { SocialEmail } from './SocialEmailTemplate.js'
import { getSocialEmailContent, type SocialNotificationEmailInput } from './socialEmailContent.js'

export type RenderedSocialNotificationEmail = {
  html: string
  subject: string
}

export async function renderSocialNotificationEmail(
  input: SocialNotificationEmailInput
): Promise<RenderedSocialNotificationEmail> {
  const content = getSocialEmailContent(input)
  const email = createElement(SocialEmail, { content })

  return {
    html: await render(email),
    subject: content.subject
  }
}
