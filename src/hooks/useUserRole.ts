import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export type UserRole = 'admin' | 'charge_communication' | 'chef_projet' | 'partenaire' | 'membre';

// Define which roles can perform which actions on each resource
export const ROLE_PERMISSIONS: Record<string, Record<UserRole, { canCreate: boolean; canEdit: boolean; canDelete: boolean }>> = {
    projects: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: false, canEdit: false, canDelete: false },
        chef_projet: { canCreate: true, canEdit: true, canDelete: true },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    reports: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true },
        chef_projet: { canCreate: true, canEdit: true, canDelete: true },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    videos: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true },
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    news: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true },
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    team: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: false, canEdit: false, canDelete: false },
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    faq: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true }, // Usually Comms manages FAQ
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    submissions: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true },
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    newsletter: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true },
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    documents: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: true, canEdit: true, canDelete: true },
        chef_projet: { canCreate: true, canEdit: true, canDelete: true },
        partenaire: { canCreate: false, canEdit: false, canDelete: false }, // Filtered visibility logic is handled in component
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    users: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: false, canEdit: false, canDelete: false },
        chef_projet: { canCreate: false, canEdit: false, canDelete: false },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
    actions: {
        admin: { canCreate: true, canEdit: true, canDelete: true },
        charge_communication: { canCreate: false, canEdit: false, canDelete: false },
        chef_projet: { canCreate: true, canEdit: true, canDelete: true },
        partenaire: { canCreate: false, canEdit: false, canDelete: false },
        membre: { canCreate: false, canEdit: false, canDelete: false },
    },
};

// Helper function to check permissions
export const canPerformAction = (role: UserRole | null, resource: string, action: 'canCreate' | 'canEdit' | 'canDelete'): boolean => {
    if (!role) return false;
    const resourcePerms = ROLE_PERMISSIONS[resource];
    if (!resourcePerms) return false;
    const rolePerms = resourcePerms[role];
    if (!rolePerms) return false;
    return rolePerms[action];
};

interface UseUserRoleResult {
    role: UserRole | null;
    userId: string | null;
    loading: boolean;
    error: string | null;
    canCreate: (resource: string) => boolean;
    canEdit: (resource: string) => boolean;
    canDelete: (resource: string) => boolean;
}

export const useUserRole = (): UseUserRoleResult => {
    const [role, setRole] = useState<UserRole | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserRole = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get current session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    throw sessionError;
                }

                if (!session?.user) {
                    setRole(null);
                    setUserId(null);
                    setLoading(false);
                    return;
                }

                setUserId(session.user.id);

                // Fetch user profile to get role
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profileError) {
                    // If profile doesn't exist, default to 'membre'
                    if (profileError.code === 'PGRST116') {
                        setRole('membre');
                    } else {
                        throw profileError;
                    }
                } else {
                    setRole((profile?.role as UserRole) || 'membre');
                }
            } catch (err: any) {
                console.error('Error fetching user role:', err);
                setError(err.message || 'Erreur lors de la récupération du rôle');
                setRole('membre'); // Default to membre on error
            } finally {
                setLoading(false);
            }
        };

        fetchUserRole();

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                fetchUserRole();
            } else {
                setRole(null);
                setUserId(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Permission check functions
    const canCreate = (resource: string) => canPerformAction(role, resource, 'canCreate');
    const canEdit = (resource: string) => canPerformAction(role, resource, 'canEdit');
    const canDelete = (resource: string) => canPerformAction(role, resource, 'canDelete');

    return { role, userId, loading, error, canCreate, canEdit, canDelete };
};

export default useUserRole;
