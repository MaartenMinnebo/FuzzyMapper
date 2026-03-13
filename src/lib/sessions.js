import { supabase } from './supabase';

export async function listSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, name, source_file_name, target_file_name, total, matched_count, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSession({ name, sourceFileName, targetFileName, sourceList, targetList, matches, total, matchedCount }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      name,
      source_file_name: sourceFileName,
      target_file_name: targetFileName,
      source_list: sourceList,
      target_list: targetList,
      matches,
      total,
      matched_count: matchedCount,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSession(id, { matches, matchedCount, sourceList }) {
  const { error } = await supabase
    .from('sessions')
    .update({
      matches,
      matched_count: matchedCount,
      // sourceList may have cached results updated, re-save
      source_list: sourceList,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function loadSession(id) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(id) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
