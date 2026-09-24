import { render } from '@react-email/render'
import { createElement } from 'react'

import { AuthEmail } from './AuthEmailTemplate.js'
import {
  getAuthEmailContent,
  getAuthEmailPlainText,
  type AuthEmailProps
} from './authEmailContent.js'

export type RenderedAuthEmail = {
  html: string
  subject: string
  text: string
}

export async function renderAuthEmail(input: AuthEmailProps): Promise<RenderedAuthEmail> {
  return {
    html: await render(createElement(AuthEmail, input)),
    subject: getAuthEmailContent(input.action).subject,
    text: getAuthEmailPlainText(input)
  }
}
