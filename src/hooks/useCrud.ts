import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface UseCrudOptions<T> {
  tableName: string;
  initialData?: T;
}

interface UseCrudReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  create: (item: Partial<T>) => Promise<T | null>;
  update: (id: number, item: Partial<T>) => Promise<T | null>;
  delete: (id: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useCrud<T extends { id: number }>({ tableName }: UseCrudOptions<T>): UseCrudReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Essayer d'abord avec id (qui devrait toujours exister)
      let { data: fetchedData, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .order('id', { ascending: false });

      // Si id échoue, essayer avec created_at
      if (fetchError) {
        const retry = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false });
        
        if (retry.error) {
          // Si les deux échouent, essayer sans tri
          const noOrder = await supabase
            .from(tableName)
            .select('*');
          
          if (noOrder.error) throw noOrder.error;
          fetchedData = noOrder.data;
        } else {
          fetchedData = retry.data;
        }
      }

      setData(fetchedData || []);
    } catch (err: any) {
      let errorMessage = 'Erreur lors du chargement des données';
      
      // Messages d'erreur plus explicites
      if (err.code === 'PGRST116' || err.code === '42703') {
        errorMessage = `La colonne de tri n'existe pas dans la table "${tableName}"`;
      } else if (err.code === '42P01' || err.code === 'PGRST301') {
        errorMessage = `La table "${tableName}" n'existe pas dans la base de données`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error(`Error fetching ${tableName}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const create = async (item: Partial<T>): Promise<T | null> => {
    try {
      setError(null);
      const { data: newItem, error: createError } = await supabase
        .from(tableName)
        .insert(item)
        .select()
        .single();

      if (createError) throw createError;
      if (newItem) {
        setData((prev) => [newItem, ...prev]);
        return newItem;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
      console.error(`Error creating ${tableName}:`, err);
      throw err;
    }
  };

  const update = async (id: number, item: Partial<T>): Promise<T | null> => {
    try {
      setError(null);
      const { data: updatedItem, error: updateError } = await supabase
        .from(tableName)
        .update(item)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (updatedItem) {
        setData((prev) => prev.map((d) => (d.id === id ? updatedItem : d)));
        return updatedItem;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
      console.error(`Error updating ${tableName}:`, err);
      throw err;
    }
  };

  const deleteItem = async (id: number): Promise<boolean> => {
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setData((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
      console.error(`Error deleting ${tableName}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    fetchData();
  }, [tableName]);

  return {
    data,
    loading,
    error,
    create,
    update,
    delete: deleteItem,
    refresh: fetchData,
  };
}

