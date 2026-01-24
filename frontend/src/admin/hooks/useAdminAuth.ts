import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

interface AdminUser {
    id: string; // UUID from admin_users (or auth.users)
    email: string;
    role: 'super_admin' | 'traffic_manager' | 'operator' | 'auditor';
    full_name: string;
}

export function useAdminAuth() {
    const [admin, setAdmin] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                verifyAdminRole(session.user.id, session.user.email!);
            } else {
                setAdmin(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }
            await verifyAdminRole(session.user.id, session.user.email!);
        } catch (error) {
            console.error("Auth check failed:", error);
            setLoading(false);
        }
    }

    async function verifyAdminRole(authUserId: string, email: string) {
        try {
            // Logic: Check if this email exists in 'admin_users'
            // Note: In a production app, we should link auth.uid to admin_users.id
            // For now, we match by EMAIL as the admin_users table might be seeded manually

            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', email)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                console.warn("User authenticated but not an Admin:", email);
                await supabase.auth.signOut();
                setAdmin(null);
                throw new Error("Unauthorized: Access restricted to Admin personnel.");
            }

            setAdmin(data as AdminUser);
        } catch (error) {
            // If verification fails, ensure we are logged out locally
            setAdmin(null);
        } finally {
            setLoading(false);
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut();
        setAdmin(null);
        navigate('/admin/login');
    };

    return { admin, loading, signOut };
}
