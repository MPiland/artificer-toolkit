import { createClient } from '@supabase/supabase-js'

export const createSupabaseClient = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
