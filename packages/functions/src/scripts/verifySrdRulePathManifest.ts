import { readFileSync } from 'node:fs'

import {
  assertRulePathManifestFresh,
  generateSrdRulePathManifest
} from '../services/rules/systems/dnd5e/srdRulePathManifest.js'

const artifact = new URL('../../../db/src/source-data/srd/rule-path-manifest.json', import.meta.url)
assertRulePathManifestFresh(
  JSON.parse(readFileSync(artifact, 'utf8')),
  generateSrdRulePathManifest()
)
