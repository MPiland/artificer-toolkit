import { build } from 'esbuild'
import { glob } from 'glob'

const functionFiles = await glob('lib/dnd5e2014/**/*Mapping.ts')

const metaFiles = await glob('lib/dnd5e2014/**/*MetaFactory.ts')

await build({
  sourcemap: 'inline',
  sourcesContent: false,
  format: 'esm',
  target: 'esnext',
  platform: 'node',
  external: ['@aws-appsync/utils'],
  outdir: 'lib/dnd5e2014/jsFunctionMappings',
  entryNames: '[name]',
  entryPoints: functionFiles,
  bundle: true,
})

await build({
  sourcemap: 'inline',
  sourcesContent: false,
  format: 'esm',
  target: 'esnext',
  platform: 'node',
  external: ['@aws-appsync/utils'],
  outdir: 'lib/dnd5e2014/jsFunctionMappings/utils',
  entryNames: '[name]',
  entryPoints: metaFiles,
  bundle: true,
})
