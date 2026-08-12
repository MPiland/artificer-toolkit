import { Client, NovuRequestHandler } from '@novu/framework'
import { notificationWorkflows } from '@artificer-toolkit/functions/services/notifications/workflows'

function requiredSecretKey(): string {
  const value = process.env.NOVU_SECRET_KEY
  if (!value) throw new Error('NOVU_SECRET_KEY is required.')
  return value
}

let handler: ((request: Request) => Promise<Response>) | undefined

function getHandler(): (request: Request) => Promise<Response> {
  handler ??= new NovuRequestHandler<[Request], Response>({
    frameworkName: 'netlify',
    client: new Client({ secretKey: requiredSecretKey(), verbose: false }),
    workflows: notificationWorkflows,
    handler: (request) => ({
      body: () => request.json(),
      headers: (name) => request.headers.get(name),
      method: () => request.method,
      queryString: (name, url) => url.searchParams.get(name),
      url: () => new URL(request.url),
      transformResponse: (response) =>
        new Response(response.body, {
          status: response.status,
          headers: response.headers
        })
    })
  }).createHandler()

  return handler
}

export default async function novu(request: Request): Promise<Response> {
  return getHandler()(request)
}
