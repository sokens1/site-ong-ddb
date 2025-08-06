import { supabase } from '../supabaseClient';


export const fetchActions = async () => {
  const { data, error } = await supabase
    .from('actions')
    .select('*');

  if (error) {
    console.error('Error fetching actions:', error);
    return [];
  }
  return data;
};
