import { AwsClient } from 'aws4fetch'

export const vttMapMultipartChunkBytes = 6 * 1024 * 1024

type Fetch = typeof fetch

type R2Configuration = {
  accessKeyId: string
  bucket: string
  endpoint: string
  secretAccessKey: string
}

export type R2CompletedPart = { etag: string; partNumber: number }

export class R2VttMapStorage {
  readonly #bucket: string
  readonly #client: AwsClient
  readonly #endpoint: string
  readonly #fetch: Fetch

  constructor(configuration: R2Configuration, fetchImplementation: Fetch = fetch) {
    this.#bucket = configuration.bucket
    this.#endpoint = configuration.endpoint.replace(/\/+$/, '')
    this.#fetch = fetchImplementation
    this.#client = new AwsClient({
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
      region: 'auto',
      service: 's3'
    })
  }

  async createMultipartUpload(objectKey: string, contentType: string): Promise<string> {
    const response = await this.#request('POST', objectKey, { uploads: '' }, undefined, {
      'content-type': contentType
    })
    const uploadId = xmlValues(await response.text(), 'UploadId')[0]
    if (!uploadId) throw new Error('R2 did not return a multipart upload identity.')
    return uploadId
  }

  async createMultipartPartUrls(
    objectKey: string,
    uploadId: string,
    partCount: number,
    expiresInSeconds: number
  ): Promise<{ partNumber: number; url: string }[]> {
    return Promise.all(
      Array.from({ length: partCount }, async (_, index) => {
        const partNumber = index + 1
        const url = this.#objectUrl(objectKey, {
          partNumber: String(partNumber),
          uploadId,
          'X-Amz-Expires': String(expiresInSeconds)
        })
        const signed = await this.#client.sign(url, {
          method: 'PUT',
          aws: { signQuery: true }
        })
        return { partNumber, url: signed.url }
      })
    )
  }

  async completeMultipartUpload(
    objectKey: string,
    uploadId: string,
    parts: readonly R2CompletedPart[]
  ): Promise<void> {
    const body = `<CompleteMultipartUpload>${parts
      .map(
        (part) =>
          `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`
      )
      .join('')}</CompleteMultipartUpload>`
    await this.#request('POST', objectKey, { uploadId }, body, {
      'content-type': 'application/xml'
    })
  }

  async abortMultipartUpload(objectKey: string, uploadId: string): Promise<void> {
    await this.#request('DELETE', objectKey, { uploadId }, undefined, undefined, true)
  }

  async download(objectKey: string): Promise<Buffer | null> {
    const response = await this.#request('GET', objectKey, undefined, undefined, undefined, true)
    return response.status === 404 ? null : Buffer.from(await response.arrayBuffer())
  }

  async exists(objectKey: string): Promise<boolean> {
    const response = await this.#request('HEAD', objectKey, undefined, undefined, undefined, true)
    return response.status !== 404
  }

  async list(prefix: string): Promise<string[]> {
    const response = await this.#request('GET', '', { 'list-type': '2', prefix })
    return xmlValues(await response.text(), 'Key')
  }

  async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.#request('PUT', objectKey, undefined, Uint8Array.from(body), {
      'content-type': contentType
    })
  }

  async remove(objectKeys: readonly string[]): Promise<void> {
    await Promise.all(
      [...new Set(objectKeys)].map((objectKey) =>
        this.#request('DELETE', objectKey, undefined, undefined, undefined, true).then(
          (response) => {
            if (response.status !== 404 && !response.ok)
              throw new Error('Unable to remove R2 object.')
          }
        )
      )
    )
  }

  async signedDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    const url = this.#objectUrl(objectKey, { 'X-Amz-Expires': String(expiresInSeconds) })
    const signed = await this.#client.sign(url, { method: 'GET', aws: { signQuery: true } })
    return signed.url
  }

  async #request(
    method: string,
    objectKey: string,
    query?: Readonly<Record<string, string>>,
    body?: BodyInit,
    headers?: HeadersInit,
    allowNotFound = false
  ): Promise<Response> {
    const signed = await this.#client.sign(this.#objectUrl(objectKey, query), {
      body,
      headers,
      method
    })
    const response = await this.#fetch(signed)
    if (!response.ok && !(allowNotFound && response.status === 404)) {
      const detail = (await response.text()).slice(0, 300)
      throw new Error(`R2 ${method} failed (${response.status})${detail ? `: ${detail}` : '.'}`)
    }
    return response
  }

  #objectUrl(objectKey: string, query?: Readonly<Record<string, string>>): URL {
    const key = objectKey.split('/').filter(Boolean).map(encodeURIComponent).join('/')
    const url = new URL(`${this.#endpoint}/${encodeURIComponent(this.#bucket)}/${key}`)
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value)
    return url
  }
}

export function createR2VttMapStorageFromEnvironment(): R2VttMapStorage {
  const accountId = requiredEnvironment('R2_ACCOUNT_ID')
  return new R2VttMapStorage({
    accessKeyId: requiredEnvironment('R2_ACCESS_KEY_ID'),
    bucket: requiredEnvironment('R2_VTT_MAP_BUCKET'),
    endpoint: process.env.R2_S3_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
    secretAccessKey: requiredEnvironment('R2_SECRET_ACCESS_KEY')
  })
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for VTT map storage.`)
  return value
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function xmlValues(source: string, tag: string): string[] {
  const expression = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g')
  return [...source.matchAll(expression)].map((match) =>
    (match[1] ?? '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&amp;', '&')
  )
}
