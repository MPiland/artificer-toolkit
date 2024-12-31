import { createContext } from 'react'
import { FeatureOptionsType } from './FeatureProvider'

export const FeatureContext = createContext<FeatureOptionsType>(undefined)

export type UpdateFeatureData = FeatureOptionsType['updateFeatureData']
export type UpdateOptionData = FeatureOptionsType['updateOptionData']
export type UpdateSectionDataType = FeatureOptionsType['updateSectionData']
export type UpdateSubfeatureData = FeatureOptionsType['updateSubfeatureData']
