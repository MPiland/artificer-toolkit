import type {
  HealthDescriptiveStateDto,
  HealthDisplayLevelDto
} from '@artificer-toolkit/schema/api/healthDisplay'

export const healthDisplayLevelLabels: Record<HealthDisplayLevelDto, string> = {
  HIDDEN: 'Hidden',
  DESCRIPTIVE: 'Descriptive',
  BAR: 'Bar',
  EXACT: 'Exact'
}

const healthDisplayLevels: HealthDisplayLevelDto[] = ['HIDDEN', 'DESCRIPTIVE', 'BAR', 'EXACT']

export const healthDisplayLevelOptions = healthDisplayLevels.map((value) => ({
  label: healthDisplayLevelLabels[value],
  value
}))

export const healthDescriptiveStateLabels: Record<HealthDescriptiveStateDto, string> = {
  UNHURT: 'Unhurt',
  HURT: 'Hurt',
  BLOODIED: 'Bloodied',
  NEAR_DEATH: 'Near death'
}
