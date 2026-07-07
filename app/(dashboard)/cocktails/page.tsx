export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { CocktailsClient } from './CocktailsClient'

export default async function CocktailsPage() {
  const supabase = await createClient()

  const [{ data: cocktails }, { data: ingredients }] = await Promise.all([
    supabase.from('cocktails').select('*, cocktail_recipes(*, ingredients(*))').is('deleted_at', null).order('name'),
    supabase.from('ingredients').select('*').eq('is_active', true).order('name'),
  ])

  return <CocktailsClient cocktails={cocktails ?? []} ingredients={ingredients ?? []} />
}
