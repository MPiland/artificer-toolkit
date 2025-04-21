import { createContext } from 'react'
import { FeatureOptionsType } from './FeatureProvider'

export const FeatureContext = createContext<FeatureOptionsType>({} as FeatureOptionsType)

export type UpdateFeatureData = FeatureOptionsType['featureStore']
export type UpdateOptionData = FeatureOptionsType['optionStore']
export type UpdateSectionDataType = FeatureOptionsType['sectionStore']
