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
      
      // Nettoyer les valeurs vides (les convertir en null pour éviter les erreurs)
      // Ne pas mapper automatiquement car Supabase respecte les noms de colonnes exacts
      const cleanedItem: any = {};
      Object.entries(item).forEach(([key, value]) => {
        if (value !== undefined) {
          // Convertir les chaînes vides en null
          cleanedItem[key] = value === '' ? null : value;
        }
      });
      
      console.log(`Creating ${tableName} with data:`, cleanedItem);
      console.log(`Cleaned item keys:`, Object.keys(cleanedItem));
      console.log(`Cleaned item values:`, Object.values(cleanedItem));
      
      const { data: newItem, error: createError } = await supabase
        .from(tableName)
        .insert(cleanedItem)
        .select()
        .single();

      if (createError) {
        console.error(`Error creating ${tableName}:`, createError);
        console.error('Error code:', createError.code);
        console.error('Error message:', createError.message);
        console.error('Error details:', createError.details);
        console.error('Error hint:', createError.hint);
        console.error('Full error object:', JSON.stringify(createError, null, 2));
        console.error('Data being inserted:', JSON.stringify(cleanedItem, null, 2));
        throw createError;
      }
      
      if (newItem) {
        setData((prev) => [newItem, ...prev]);
        return newItem;
      }
      return null;
    } catch (err: any) {
      let errorMessage = 'Erreur lors de la création';
      
      if (err.code === '23502') {
        errorMessage = `Une colonne requise est manquante. Vérifiez que tous les champs obligatoires sont remplis.`;
      } else if (err.code === '23503') {
        errorMessage = `Erreur de référence: une valeur ne correspond à aucune référence existante.`;
      } else if (err.code === '23505') {
        errorMessage = `Cette entrée existe déjà (contrainte unique).`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error(`Error creating ${tableName}:`, err);
      console.error('Item data:', item);
      throw err;
    }
  };

  const update = async (id: number, item: Partial<T>): Promise<T | null> => {
    try {
      setError(null);
      
      // Nettoyer les valeurs vides (les convertir en null pour éviter les erreurs)
      const cleanedItem: any = {};
      Object.entries(item).forEach(([key, value]) => {
        if (value !== undefined) {
          // Convertir les chaînes vides en null
          cleanedItem[key] = value === '' ? null : value;
        }
      });
      
      console.log(`Updating ${tableName} with data:`, cleanedItem);
      
      const { data: updatedItem, error: updateError } = await supabase
        .from(tableName)
        .update(cleanedItem)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error(`Error updating ${tableName}:`, updateError);
        console.error('Error code:', updateError.code);
        console.error('Error message:', updateError.message);
        console.error('Error details:', updateError.details);
        console.error('Data being updated:', JSON.stringify(cleanedItem, null, 2));
        throw updateError;
      }
      
      if (updatedItem) {
        setData((prev) => prev.map((d) => (d.id === id ? updatedItem : d)));
        return updatedItem;
      }
      return null;
    } catch (err: any) {
      let errorMessage = 'Erreur lors de la mise à jour';
      
      if (err.code === '23502') {
        errorMessage = `Une colonne requise est manquante.`;
      } else if (err.code === '23503') {
        errorMessage = `Erreur de référence: une valeur ne correspond à aucune référence existante.`;
      } else if (err.code === '23505') {
        errorMessage = `Cette entrée existe déjà (contrainte unique).`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error(`Error updating ${tableName}:`, err);
      console.error('Item data:', item);
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

