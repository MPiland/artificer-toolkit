// patch-generated-types.ts
import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'

const filePath = path.resolve(__dirname, '../../gql/types.ts')

try {
  const content = readFileSync(filePath, 'utf-8')

  const patched = content.replace(
    /export type (\w+Input) = \{([\s\S]+?)\n\};/g,
    (match: string, typeName: string, fields: string) => {
      const discriminator = `  __kind: '${typeName}';`
      if (fields.includes('kind:')) return match
      return `export type ${typeName} = {\n${discriminator}${fields}\n};`
    }
  )

  writeFileSync(filePath, patched)
  console.log('✅ Patched input types with discriminators.')
} catch (err) {
  console.error('❌ Failed to patch input types:', err)
}