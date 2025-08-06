import { supabase } from '../supabaseClient';


export const fetchReports = async () => {
  const { data, error } = await supabase
    .from('reports')
    .select('*');

  if (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
  return data;
};
