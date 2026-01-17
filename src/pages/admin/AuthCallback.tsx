import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Vérification en cours...');

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Get the token from the URL hash or query params
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const type = hashParams.get('type') || searchParams.get('type');

                if (accessToken && refreshToken) {
                    // Set the session
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    if (error) throw error;

                    setStatus('success');
                    setMessage('Email confirmé avec succès ! Redirection vers la connexion...');

                    // Redirect to login after 2 seconds
                    setTimeout(() => {
                        navigate('/admin/login');
                    }, 2000);
                } else if (type === 'signup' || type === 'email_confirmation') {
                    // Handle email confirmation without tokens (might be handled by Supabase)
                    setStatus('success');
                    setMessage('Email confirmé avec succès ! Vous pouvez maintenant vous connecter.');

                    setTimeout(() => {
                        navigate('/admin/login');
                    }, 2000);
                } else {
                    // No tokens found, check if there's an error
                    const error = searchParams.get('error_description') || hashParams.get('error_description');
                    if (error) {
                        throw new Error(error);
                    }

                    // Just redirect to login
                    setStatus('success');
                    setMessage('Redirection vers la connexion...');
                    setTimeout(() => {
                        navigate('/admin/login');
                    }, 1000);
                }
            } catch (err: any) {
                console.error('Auth callback error:', err);
                setStatus('error');
                setMessage(err.message || 'Une erreur est survenue lors de la confirmation.');
            }
        };

        handleAuthCallback();
    }, [navigate, searchParams]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <>
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-6"></div>
                        <h1 className="text-xl font-bold text-gray-800 mb-2">Vérification en cours</h1>
                        <p className="text-gray-600">{message}</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-green-600 mb-2">Succès !</h1>
                        <p className="text-gray-600">{message}</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-red-600 mb-2">Erreur</h1>
                        <p className="text-gray-600 mb-4">{message}</p>
                        <button
                            onClick={() => navigate('/admin/login')}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                            Aller à la connexion
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthCallback;
