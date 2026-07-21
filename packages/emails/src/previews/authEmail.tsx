import { AuthEmail } from '../AuthEmailTemplate.js'

export default function AuthEmailPreview() {
  return (
    <AuthEmail
      action='signup'
      actionUrl='https://example.com/auth/v1/verify?token=preview-token&type=signup'
      token='123456'
    />
  )
}
