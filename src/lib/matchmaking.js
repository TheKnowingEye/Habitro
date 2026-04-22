import { supabase } from './supabase';

export async function getActiveDuel(userId) {
  const { data, error } = await supabase
    .from('duels')
    .select('*, scores(*)')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'active')
    .single();

  if (error) return null;
  return data;
}
