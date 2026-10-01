import assert from 'node:assert/strict'
import { ConvexClient } from 'convex/browser'
import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import type { verifyCharacterConcurrency } from './developmentCharacterConcurrency'
import type { DevelopmentClient } from './developmentClient'
import { api } from '../convex/_generated/api.js'

export async function verifyCharacterReconnect({
  url,
  fetchToken,
  peer,
  proof
}: {
  url: string
  fetchToken: () => Promise<string>
  peer: DevelopmentClient
  proof: Awaited<ReturnType<typeof verifyCharacterConcurrency>>
}) {
  const sockets: WebSocket[] = []
  class ProofWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      sockets.push(this)
    }
  }
  const sdk = new ConvexClient(url, { logger: false, webSocketConstructor: ProofWebSocket })
  sdk.setAuth(fetchToken)
  const characterId = proof.originalNoteInput.id
  const deadline = Date.now() + 60_000

  async function bounded<T>(work: Promise<T>, milliseconds = Math.max(0, deadline - Date.now())) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Character reconnect proof timed out.')),
            milliseconds
          )
        })
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  function observeVersion(version: number) {
    return new Promise<CharacterSheetCommonDto>((resolve, reject) => {
      const unsubscribe = sdk.onUpdate(
        api.characters.sheetSlices.get,
        { id: characterId, slice: 'COMMON' },
        (response) => {
          if (response?.slice !== 'COMMON') return
          const sheet = response.data
          if (sheet?.meta.streamVersion !== version) return
          unsubscribe()
          resolve(sheet)
        },
        (error) => {
          unsubscribe()
          reject(error)
        }
      )
    })
  }

  try {
    assert.deepEqual(
      await bounded(observeVersion(proof.currentSheet.meta.streamVersion)),
      proof.currentSheet
    )
    const disconnected = sockets.at(-1)
    assert.ok(disconnected)
    const countBeforeDisconnect = sockets.length
    const nextVersion = proof.currentSheet.meta.streamVersion + 1
    const observed = observeVersion(nextVersion)
    disconnected.close(4000, 'Character reconnect proof')
    const [command, reconnectedSheet] = await bounded(
      Promise.all([
        peer.mutation(api.characters.sheetCommands.execute, {
          id: characterId,
          command: {
            type: 'SET_INSPIRATION',
            commandId: crypto.randomUUID(),
            expectedVersion: proof.currentSheet.meta.streamVersion,
            inspired: !proof.currentSheet.overview.inspiration
          }
        }),
        observed
      ])
    )
    assert.ok(sockets.length > countBeforeDisconnect, 'SDK must open a new WebSocket.')
    assert.equal(command.characterId, characterId)
    assert.equal(reconnectedSheet.meta.streamVersion, command.streamVersion)
    assert.deepEqual(reconnectedSheet, {
      ...proof.currentSheet,
      meta: { ...proof.currentSheet.meta, streamVersion: nextVersion },
      overview: {
        ...proof.currentSheet.overview,
        inspiration: !proof.currentSheet.overview.inspiration
      }
    })
    const replay = await bounded(
      sdk.mutation(api.characters.sheetCommands.execute, proof.originalNoteInput)
    )
    assert.deepEqual(replay, { ...proof.originalReceipt, streamVersion: nextVersion })
    const queried = await bounded(
      peer.query(api.characters.sheetSlices.get, { id: characterId, slice: 'COMMON' })
    )
    assert.ok(queried?.slice === 'COMMON')
    assert.deepEqual(queried.data, reconnectedSheet)
    console.log(
      JSON.stringify({
        proof: 'Character SDK reconnect',
        resubscribed: 'PASS',
        exactReplay: 'PASS',
        streamVersion: nextVersion
      })
    )
  } finally {
    const closing = sdk.close()
    for (const socket of sockets) if (socket.readyState !== WebSocket.CLOSED) socket.close()
    await bounded(closing, 5000)
  }
}
