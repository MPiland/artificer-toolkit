import { type ClassAuthored } from '@artificer-toolkit/shared'
import { barbarian } from './barbarian.js'
import { bard } from './bard.js'
import { cleric } from './cleric.js'
import { pathOfTheBerserker } from './path-of-the-berserker.js'
import { collegeOfLore } from './college-of-lore.js'
import { lifeDomainCleric } from './life-domain.js'
import { druid } from './druid.js'
import { fighter } from './fighter.js'
import { circleOfTheLand } from './circle-of-the-land.js'
import { championMartialArchetype } from './champion.js'
import { monk } from './monk.js'
import { paladin } from './paladin.js'
import { wayOfTheOpenHand } from './way-of-the-open-hand.js'
import { oathOfDevotion } from './oath-of-devotion.js'
import { ranger } from './ranger.js'
import { rogue } from './rogue.js'
import { hunterConclave } from './hunter.js'
import { thiefRoguishArchetype } from './thief.js'
import { sorcerer } from './sorcerer.js'
import { draconicBloodlineOrigin } from './draconic-bloodline.js'
import { warlock } from './warlock.js'
import { theFiend } from './the-fiend.js'
import { wizard } from './wizard.js'
import { schoolOfEvocation } from './school-of-evocation.js'

export const srdClasses: ClassAuthored[] = [
  // Base classes
  barbarian,
  bard,
  cleric,
  druid,
  fighter,
  monk,
  paladin,
  ranger,
  rogue,
  sorcerer,
  warlock,
  wizard,
  // Subclasses
  pathOfTheBerserker,
  collegeOfLore,
  lifeDomainCleric,
  circleOfTheLand,
  championMartialArchetype,
  wayOfTheOpenHand,
  oathOfDevotion,
  hunterConclave,
  thiefRoguishArchetype,
  draconicBloodlineOrigin,
  theFiend,
  schoolOfEvocation
]
