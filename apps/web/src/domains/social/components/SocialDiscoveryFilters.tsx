import { Accordion, NumberInput, TextInput } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getSystemList } from '#app/data/systems/queries'
import { AppMultiSelect, AppSelect } from '#ui/primitives/Select'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import {
  campaignFormatOptions,
  contentMaturityOptions,
  playModeOptions,
  safetyPracticeOptions,
  scheduleKindOptions,
  toneTagOptions,
  weekdayOptions
} from '../socialModels'
import type { SocialHubSearch } from '../socialSearch'
import {
  toSocialDiscoveryCampaignFormat,
  toSocialDiscoveryContentMaturity,
  toSocialDiscoveryPlayMode,
  toSocialDiscoverySafetyPractice,
  toSocialDiscoveryScheduleKind
} from '../socialDiscovery'
import * as styles from './SocialDiscoveryFilters.css'

export function SocialDiscoveryFilters({
  search,
  onSearchChange
}: {
  search: SocialHubSearch
  onSearchChange: (next: SocialHubSearch) => void
}) {
  const systems = useQuery(getSystemList())
  const set = <TKey extends keyof SocialHubSearch>(key: TKey, value: SocialHubSearch[TKey]) =>
    onSearchChange({ ...search, [key]: value })
  const defaultSections = [
    'game-style',
    ...(search.playMode ||
    search.scheduleKind ||
    search.weekday !== undefined ||
    search.timeZone ||
    search.city ||
    search.stateCode
      ? ['when-and-where']
      : []),
    ...(search.minimumAvailableSeats || search.safetyPractice ? ['table-needs'] : [])
  ]

  return (
    <Accordion
      multiple
      unstyled
      chevronPosition='right'
      classNames={{
        chevron: styles.filterGroupChevron,
        content: styles.filterGroupContent,
        control: styles.filterGroupControl,
        item: styles.filterGroupItem,
        label: styles.filterGroupLabel,
        root: styles.filterGroups
      }}
      defaultValue={defaultSections}
    >
      <Accordion.Item value='game-style'>
        <Accordion.Control>Game style</Accordion.Control>
        <Accordion.Panel>
          <div className={styles.filterGroupFields}>
            <AppSelect
              clearable
              data={(systems.data ?? []).map((system) => ({
                label: system.label,
                value: system.id
              }))}
              label='System'
              value={search.systemId ?? null}
              onChange={(value) => set('systemId', value ?? undefined)}
            />
            <AppSelect
              clearable
              data={campaignFormatOptions.map((option) => ({ ...option }))}
              label='Format'
              value={search.format ?? null}
              onChange={(value) => set('format', toSocialDiscoveryCampaignFormat(value))}
            />
            <AppSelect
              clearable
              data={contentMaturityOptions.map((option) => ({ ...option }))}
              label='Content maturity'
              value={search.contentMaturity ?? null}
              onChange={(value) => set('contentMaturity', toSocialDiscoveryContentMaturity(value))}
            />
            <AppMultiSelect
              clearable
              data={toneTagOptions.map((option) => ({ ...option }))}
              label='Tone'
              maxValues={3}
              value={search.toneTags ?? []}
              onChange={(value) =>
                set(
                  'toneTags',
                  toneTagOptions
                    .filter((option) => value.includes(option.value))
                    .map((option) => option.value)
                )
              }
            />
          </div>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value='when-and-where'>
        <Accordion.Control>When &amp; where</Accordion.Control>
        <Accordion.Panel>
          <div className={styles.filterGroupFields}>
            <AppSelect
              clearable
              data={playModeOptions.map((option) => ({ ...option }))}
              label='Play mode'
              value={search.playMode ?? null}
              onChange={(value) => set('playMode', toSocialDiscoveryPlayMode(value))}
            />
            <AppSelect
              clearable
              data={scheduleKindOptions.map((option) => ({ ...option }))}
              label='Schedule'
              value={search.scheduleKind ?? null}
              onChange={(value) => set('scheduleKind', toSocialDiscoveryScheduleKind(value))}
            />
            <AppSelect
              clearable
              data={weekdayOptions}
              disabled={search.scheduleKind !== 'RECURRING'}
              label='Weekday'
              value={search.weekday === undefined ? null : String(search.weekday)}
              onChange={(value) => set('weekday', value === null ? undefined : Number(value))}
            />
            <TextInput
              classNames={{
                input: inputStyles.input,
                label: inputStyles.label,
                root: inputStyles.root
              }}
              label='Timezone'
              placeholder='America/Chicago'
              value={search.timeZone ?? ''}
              onChange={(event) => set('timeZone', event.currentTarget.value || undefined)}
            />
            <TextInput
              classNames={{
                input: inputStyles.input,
                label: inputStyles.label,
                root: inputStyles.root
              }}
              label='City'
              value={search.city ?? ''}
              onChange={(event) => set('city', event.currentTarget.value || undefined)}
            />
            <TextInput
              classNames={{
                input: inputStyles.input,
                label: inputStyles.label,
                root: inputStyles.root
              }}
              label='State'
              maxLength={2}
              placeholder='IL'
              value={search.stateCode ?? ''}
              onChange={(event) =>
                set('stateCode', event.currentTarget.value.toUpperCase() || undefined)
              }
            />
          </div>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value='table-needs'>
        <Accordion.Control>Table needs</Accordion.Control>
        <Accordion.Panel>
          <div className={styles.filterGroupFields}>
            <NumberInput
              classNames={{
                input: inputStyles.input,
                label: inputStyles.label,
                root: inputStyles.root
              }}
              hideControls
              label='Seats needed'
              max={100}
              min={1}
              value={search.minimumAvailableSeats ?? ''}
              onChange={(value) =>
                set('minimumAvailableSeats', typeof value === 'number' ? value : undefined)
              }
            />
            <AppSelect
              clearable
              data={safetyPracticeOptions.map((option) => ({ ...option }))}
              label='Safety practice'
              value={search.safetyPractice ?? null}
              onChange={(value) => set('safetyPractice', toSocialDiscoverySafetyPractice(value))}
            />
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}
