import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { abilityScoreCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import type { EncounterGmActorDto } from '@artificer-toolkit/schema/api/encounters'
import { useQuery } from 'convex/react'
import * as encounterStyles from './encounter.css'
import { encounterStatBlockDefenses, encounterStatBlockSenses } from './encounterStatBlock.utils'

export function EncounterEnemyStatBlock({ actor }: { actor: EncounterGmActorDto }) {
  // Defenses are vocabulary ids; the System names them.
  const system = useQuery(
    convexApi.content.systems.get,
    actor.systemId ? { id: actor.systemId } : 'skip'
  )
  const statBlock = actor.statBlock
  if (!statBlock) return null
  const abilityScores = Object.entries(statBlock.abilityScores ?? {}).sort(
    ([left], [right]) => abilitySortIndex(left) - abilitySortIndex(right)
  )
  const defenses = encounterStatBlockDefenses(statBlock, system)
  const abilityModifier = actor.systemId
    ? abilityScoreCapabilityRegistry.require(actor.systemId).abilityModifier
    : null

  return (
    <section
      className={encounterStyles.encounterStatBlock}
      aria-label={`${actor.label} statistics`}
    >
      <dl className={encounterStyles.encounterStatSummary}>
        <div>
          <dt>Armor Class</dt>
          <dd>{statBlock.armorClass ?? '—'}</dd>
        </div>
        <div>
          <dt>Hit Points</dt>
          <dd>
            {actor.currentHitPoints} / {actor.maxHitPoints}
          </dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{formatSpeedList(statBlock.speeds)}</dd>
        </div>
        <div>
          <dt>Senses</dt>
          <dd>{formatTextList(encounterStatBlockSenses(statBlock, system))}</dd>
        </div>
      </dl>
      {abilityScores.length ? (
        <dl className={encounterStyles.encounterAbilities}>
          {abilityScores.map(([ability, score]) => (
            <div key={ability}>
              <dt>{ability.slice(0, 3).toUpperCase()}</dt>
              <dd>
                <strong>{score}</strong>
                {abilityModifier ? (
                  <span>{formatAbilityModifier(abilityModifier(score))}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {defenses.length > 0 ? (
        <dl className={encounterStyles.encounterDefenseList}>
          {defenses.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

const abilityOrder = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

function abilitySortIndex(ability: string): number {
  const index = abilityOrder.indexOf(ability.slice(0, 3).toUpperCase())
  return index === -1 ? abilityOrder.length : index
}

function formatAbilityModifier(modifier: number): string {
  return `(${modifier >= 0 ? '+' : ''}${modifier})`
}

function formatTextList(values: unknown[]): string {
  if (!values.length) return '—'
  return values.map(String).join(', ')
}

function formatSpeedList(values: unknown[]): string {
  if (!values.length) return '—'
  const speeds = values.flatMap((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
    const speed = value as Record<string, unknown>
    const amount = speed.amount
    if (typeof amount !== 'number' && typeof amount !== 'string') return []
    const unit =
      speed.unit === 'FEET' ? 'ft.' : typeof speed.unit === 'string' ? speed.unit.toLowerCase() : ''
    return `${amount}${unit ? ` ${unit}` : ''}`
  })
  return speeds.length ? speeds.join(', ') : '—'
}
