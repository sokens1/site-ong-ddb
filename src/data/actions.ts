import { supabase } from '../supabaseClient';


export const fetchActions = async () => {
  try {
    const { data, error } = await supabase
      .from('actions')
      .select('*');

    if (error) {
      console.error('Error fetching actions:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching actions:', err);
    return [];
  }
};
