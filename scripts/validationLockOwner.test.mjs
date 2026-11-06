import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const library = join(import.meta.dirname, 'validationLockOwner.ps1').replaceAll('\\', '/')

const pwsh = (script) => {
  const result = spawnSync('pwsh', ['-NoProfile', '-Command', `. '${library}'; ${script}`], {
    encoding: 'utf8'
  })
  if (result.status !== 0) throw new Error(`pwsh failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

describe('Enter-ValidationLock', () => {
  let directory
  let lock
  let owner
  const owners = []

  const startOwner = async () => {
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], {
      stdio: 'ignore'
    })
    owners.push(child)
    await new Promise((resolve) => child.once('spawn', resolve))
    return child
  }
  const stop = (child) =>
    new Promise((resolve) => {
      child.once('exit', resolve)
      child.kill()
    })
  const enter = () =>
    pwsh(`Write-Output (Enter-ValidationLock '${lock}' 'waiter')`).split('\n').at(-1)

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'validation-lock-'))
    lock = join(directory, '.validation.lock').replaceAll('\\', '/')
    owner = await startOwner()
  })

  afterEach(() => {
    for (const child of owners.splice(0)) child.kill()
    rmSync(directory, { recursive: true, force: true })
  })

  it('reclaims a lock whose owner process has died, and logs it', async () => {
    writeFileSync(lock, pwsh(`Format-LockOwner 'dead-owner' ${owner.pid}`))
    await stop(owner)

    const output = pwsh(`Write-Output (Enter-ValidationLock '${lock}' 'waiter')`)

    expect(output.split('\n').at(-1)).toBe('True')
    expect(output).toContain('reclaimed')
    expect(readFileSync(lock, 'utf8')).toMatch(/^waiter pid \d+ start \d+/)
  })

  it('reclaims a lock whose pid now belongs to a process with a different start time', () => {
    const stale = pwsh(`Format-LockOwner 'reused-pid' ${owner.pid}`).replace(
      /start (\d+)/,
      (_, seconds) => `start ${Number(seconds) - 3600}`
    )
    writeFileSync(lock, stale)

    expect(enter()).toBe('True')
    expect(readFileSync(lock, 'utf8')).toMatch(/^waiter pid/)
  })

  it('never takes a lock whose owner is alive with the matching start time', () => {
    const held = pwsh(`Format-LockOwner 'live-owner' ${owner.pid}`)
    writeFileSync(lock, held)

    expect(enter()).toBe('False')
    expect(readFileSync(lock, 'utf8')).toBe(held)
  })

  it('never takes a lock it cannot read an owner from', () => {
    writeFileSync(lock, 'unparseable')

    expect(enter()).toBe('False')
    expect(readFileSync(lock, 'utf8')).toBe('unparseable')
  })

  it('takes a free lock, leaving no staged file behind', () => {
    expect(enter()).toBe('True')
    expect(readFileSync(lock, 'utf8')).toMatch(/^waiter pid \d+ start \d+/)
    expect(pwsh(`(Get-ChildItem -Force '${directory.replaceAll('\\', '/')}').Count`)).toBe('1')
  })
}, 30_000)

describe('Test-TicketOwnerAlive', () => {
  let owner

  beforeEach(async () => {
    owner = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'ignore' })
    await new Promise((resolve) => owner.once('spawn', resolve))
  })

  afterEach(() => owner.kill())

  const alive = (ticket) => pwsh(`Write-Output (Test-TicketOwnerAlive '${ticket}')`)

  it('keeps a ticket its live owner queued', () => {
    expect(alive(pwsh(`Format-QueueTicket 'waiter' ${owner.pid}`))).toBe('True')
  })

  it('drops a ticket whose pid now belongs to a process started after the ticket was written', () => {
    // A reboot reuses pids: the queued process is gone, and another process holds its pid.
    const ticket = pwsh(`Format-QueueTicket 'before-reboot' ${owner.pid}`).replace(
      /^\d+/,
      (ticks) => String(BigInt(ticks) - 36_000_000_000n).padStart(20, '0')
    )
    expect(alive(ticket)).toBe('False')
  })

  it('drops a ticket whose owner has exited', async () => {
    const ticket = pwsh(`Format-QueueTicket 'exited' ${owner.pid}`)
    await new Promise((resolve) => {
      owner.once('exit', resolve)
      owner.kill()
    })
    expect(alive(ticket)).toBe('False')
  })
}, 30_000)
