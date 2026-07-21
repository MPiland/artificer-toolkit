import { createAuthEmailHookHandler } from '@artificer-toolkit/emails/auth-hook'

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

let handler: ReturnType<typeof createAuthEmailHookHandler> | undefined

function getHandler() {
  handler ??= createAuthEmailHookHandler({
    from: getRequiredEnvironmentVariable('AUTH_EMAIL_FROM'),
    resendApiKey: getRequiredEnvironmentVariable('RESEND_API_KEY'),
    supabaseUrl: getRequiredEnvironmentVariable('SUPABASE_URL'),
    webhookSecret: getRequiredEnvironmentVariable('SEND_EMAIL_HOOK_SECRET')
  })

  return handler
}

export default async function sendAuthEmail(request: Request): Promise<Response> {
  try {
    return await getHandler()(request)
  } catch {
    return Response.json({ error: 'Authentication email delivery is unavailable' }, { status: 500 })
  }
}
