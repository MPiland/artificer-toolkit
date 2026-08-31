import { writeFileSync } from 'node:fs'

import {
  canonicalRulePathManifestJson,
  generateSrdRulePathManifest
} from '../services/rules/systems/dnd5e/srdRulePathManifest.js'

const output = new URL('../../../db/src/source-data/srd/rule-path-manifest.json', import.meta.url)
writeFileSync(output, canonicalRulePathManifestJson(generateSrdRulePathManifest()))
