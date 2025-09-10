import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient('https://xyz.supabase.co', 'public-anon-key')

// Load JSON file
const jsonData = JSON.parse(fs.readFileSync('./data.json', 'utf8'))

async function uploadData() {
  const { data, error } = await supabase.from('your_table_name').insert(jsonData)

  if (error) {
    console.error('Error uploading:', error)
  } else {
    console.log('Upload successful:', data)
  }
}

uploadData()
