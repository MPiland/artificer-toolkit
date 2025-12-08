import { useMutation, useQueryClient, queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { supabase } from '~supabase'
import { useSystemPref } from '~hooks'
import type { QueryData } from '@supabase/supabase-js'
import { addTypename, aggregateMeta, WithTypename, type WithKind } from './utils'

const backgroundsQuery = supabase
  .from('backgrounds')
  .select('id, label, description, system_id, user_id, is_master, starting_equipment_id')

const detailsQuery = supabase
  .from('background_details')
  .select('background_id, detail_id, details(*)')

const featuresQuery = supabase
  .from('background_features')
  .select('background_id, feature_id, features(*)')
