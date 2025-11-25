import { supabase } from '../supabaseClient';


export const fetchReports = async () => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*');

    if (error) {
      console.error('Error fetching reports:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching reports:', err);
    return [];
  }
};
