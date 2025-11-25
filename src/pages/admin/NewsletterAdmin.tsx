import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DataTable from '../../components/admin/DataTable';

interface NewsletterSubscriber {
  id: number;
  email: string;
  created_at?: string;
}

const NewsletterAdmin: React.FC = () => {
  const [data, setData] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Essayer d'abord avec id (qui devrait toujours exister)
      let { data: fetchedData, error: fetchError } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('id', { ascending: false });

      // Si id échoue, essayer avec created_at
      if (fetchError) {
        const retry = await supabase
          .from('newsletter_subscribers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (retry.error) {
          // Si les deux échouent, essayer sans tri
          const noOrder = await supabase
            .from('newsletter_subscribers')
            .select('*');
          
          if (noOrder.error) throw noOrder.error;
          fetchedData = noOrder.data;
        } else {
          fetchedData = retry.data;
        }
      }

      setData(fetchedData || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données');
      console.error('Error fetching newsletter subscribers:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    {
      key: 'created_at',
      label: 'Date d\'inscription',
      render: (value: string) => value ? new Date(value).toLocaleDateString('fr-FR') : '-',
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Abonnés Newsletter</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        title="Liste des abonnés"
        isLoading={loading}
      />

      {data.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          <p>Total: {data.length} abonné(s)</p>
        </div>
      )}
    </div>
  );
};

export default NewsletterAdmin;

