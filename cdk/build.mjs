import { build } from 'esbuild'
import { glob } from 'glob'

const functionFiles = await glob('lib/schemas/**/*Mapping.ts')

await build({
  sourcemap: 'inline',
  sourcesContent: false,
  format: 'esm',
  target: 'esnext',
  platform: 'node',
  external: ['@aws-appsync/utils'],
  outdir: 'lib/resolvers/jsFunctionMappings',
  entryNames: '[name]',
  entryPoints: functionFiles,
  bundle: true,
})
