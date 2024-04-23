import { combineSlices } from '@reduxjs/toolkit'
import { apiSlice } from './api/apiSlice'
import { authSlice } from '../features/auth/authSlice'
import { builderSlice } from '../features/builder/builderSlice'
import { spellSlice } from '../features/spell/spellSlice'
import { raceSlice } from '../features/race/raceSlice'
import { itemSlice } from '../features/item/itemSlice'
import { classSlice } from '../features/class/classSlice'
import { featSlice } from '../features/feat/featSlice'
import { characterSlice } from '../features/character/characterSlice'
import { backgroundSlice } from '../features/background/backgroundSlice'

export const rootReducer = combineSlices(
  apiSlice,
  authSlice,
  builderSlice,
  spellSlice,
  raceSlice,
  itemSlice,
  classSlice,
  featSlice,
  characterSlice,
  backgroundSlice
)
