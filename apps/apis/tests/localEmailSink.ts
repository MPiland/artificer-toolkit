import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLoopbackServer } from './loopbackHttpServer'

const maxMessageBytes = 256 * 1024

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!
  )
}

/**
 * The local email sink behind MAIL_DELIVERY_MODE=local (LOCAL_EMAIL_SINK_URL). It writes each
 * accepted message as one HTML file into `directory` and keeps only the newest `capacity` files,
 * so a tester can read invitations, password resets and verification emails. It binds loopback
 * only; it is a local fixture (scripts/localConvexFixtures.ps1) and never ships with a deployment.
 * Without a `directory` it uses a temporary one and removes it on close.
 */
export async function startLocalEmailSink(options: {
  directory?: string
  capacity: number
  port?: number
}) {
  const directory = options.directory ?? (await mkdtemp(join(tmpdir(), 'local-email-')))
  await mkdir(directory, { recursive: true })
  const htmlFiles = async () =>
    (await readdir(directory)).filter((file) => file.endsWith('.html')).sort()
  let sequence = 0

  async function retain(message: { to: string; subject: string; html: string; text?: string }) {
    sequence += 1
    // Sortable names: received time, then a sequence for messages in the same millisecond.
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(sequence).padStart(6, '0')}-${message.to.replace(/[^\w@.+-]/g, '_')}.html`
    const header = `<p><strong>To:</strong> ${escapeHtml(message.to)}<br><strong>Subject:</strong> ${escapeHtml(message.subject)}</p><hr>`
    const text = message.text ? `<hr><pre>${escapeHtml(message.text)}</pre>` : ''
    await writeFile(join(directory, name), `${header}${message.html}${text}`)
    const names = await htmlFiles()
    await Promise.all(
      names
        .slice(0, Math.max(0, names.length - options.capacity))
        .map((file) => rm(join(directory, file), { force: true }))
    )
  }

  const server = createLoopbackServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      return response.writeHead(200).end('artificer-local-email')
    }
    let message: unknown = null
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > maxMessageBytes) throw new Error('Email exceeds the local sink limit.')
        chunks.push(chunk)
      }
      message = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      message = null
    }
    const candidate = message as { to?: unknown; subject?: unknown; html?: unknown; text?: unknown }
    if (
      request.method !== 'POST' ||
      request.url !== '/email' ||
      typeof candidate?.to !== 'string' ||
      typeof candidate.subject !== 'string' ||
      typeof candidate.html !== 'string' ||
      (candidate.text !== undefined && typeof candidate.text !== 'string')
    ) {
      return response.writeHead(400).end()
    }
    try {
      await retain({
        to: candidate.to,
        subject: candidate.subject,
        html: candidate.html,
        ...(typeof candidate.text === 'string' ? { text: candidate.text } : {})
      })
      response.writeHead(204).end()
    } catch {
      response.writeHead(500).end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Local email sink did not bind a port.')
  return {
    url: `http://127.0.0.1:${address.port}/email`,
    /** Retained messages, oldest first. */
    messages: async () =>
      Promise.all(
        (await htmlFiles()).map(async (name) => ({
          name,
          content: await readFile(join(directory, name), 'utf8')
        }))
      ),
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
      if (options.directory === undefined) await rm(directory, { recursive: true, force: true })
    }
  }
}
