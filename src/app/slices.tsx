import { combineSlices } from '@reduxjs/toolkit'
import { apiSlice } from './api/apiSlice'
import { authSlice } from '../features/auth/authSlice'
import { deleteSlice } from './deleteSlice'
import { buildersSlice } from '../features/builders/buildersSlice'
import { spellsSlice } from '../features/spells/spellsSlice'
import { racesSlice } from '../features/races/racesSlice'
import { itemsSlice } from '../features/items/itemsSlice'
import { classesSlice } from '../features/classes/classesSlice'
import { featsSlice } from '../features/feats/featsSlice'

export const rootReducer = combineSlices(
  apiSlice,
  authSlice,
  deleteSlice,
  buildersSlice,
  spellsSlice,
  racesSlice,
  itemsSlice,
  classesSlice,
  featsSlice,
)
