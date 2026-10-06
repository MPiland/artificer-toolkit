import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const functionName = process.env.DRAFT_PROOF_FUNCTION
if (!functionName || !/^[\w./:-]+$/.test(functionName))
  throw new Error('Development fixture CLI function is missing or invalid.')
const component = process.env.DRAFT_PROOF_COMPONENT

let encodedArgs = ''
process.stdin.setEncoding('ascii')
for await (const chunk of process.stdin) encodedArgs += chunk
const rawArgs = Buffer.from(encodedArgs, 'base64').toString('utf8')
if (!rawArgs.trim()) throw new Error('Development fixture CLI arguments are missing.')
try {
  JSON.parse(rawArgs)
} catch {
  throw new Error('Development fixture CLI arguments are invalid.')
}

const require = createRequire(import.meta.url)
const packageJson = require.resolve('convex/package.json')
const binPath = resolve(dirname(packageJson), 'bin', 'main.js')
const cliArgs = ['run']
const localUrl = process.env.DRAFT_PROOF_LOCAL_URL
const localAdminKey = process.env.DRAFT_PROOF_LOCAL_ADMIN_KEY
if (localUrl || localAdminKey) {
  if (!localUrl || !localAdminKey) throw new Error('Local fixture CLI target is incomplete.')
  cliArgs.push('--url', localUrl, '--admin-key', localAdminKey)
}
if (component) cliArgs.push('--component', component)
cliArgs.push(functionName, rawArgs)
process.argv = [process.execPath, binPath, ...cliArgs]
await import(pathToFileURL(binPath).href)
