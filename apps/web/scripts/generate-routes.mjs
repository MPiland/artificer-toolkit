import process from 'node:process'
import { Generator, getConfig } from '@tanstack/router-generator'

async function main() {
  const config = await getConfig()
  const generator = new Generator({
    config,
    root: process.cwd()
  })

  await generator.run()
}

await main()
