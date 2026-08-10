import { z } from 'zod'

const signInRedirectBase = new URL('https://sign-in-redirect.invalid')

export function isSafeSignInRedirect(value: string): boolean {
  try {
    const decodedValue = decodeURIComponent(value)
    if (
      !decodedValue.startsWith('/') ||
      decodedValue.startsWith('//') ||
      decodedValue.includes('\\')
    ) {
      return false
    }

    return new URL(decodedValue, signInRedirectBase).origin === signInRedirectBase.origin
  } catch {
    return false
  }
}

export const signInRedirectSearchSchema = z.object({
  redirect: z.string().refine(isSafeSignInRedirect).optional()
})
