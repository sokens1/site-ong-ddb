import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useUserRole, UserRole } from '../../hooks/useUserRole';
import {
  LayoutDashboard,
  FileText,
  Newspaper,
  Users,
  HelpCircle,
  Mail,
  LogOut,
  Menu,
  X,
  FolderKanban,
  File,
  UserCog,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import DiscussionSidebar from '../DiscussionSidebar';
import { MessageSquare } from 'lucide-react';

// Define which menu items each role can see
const ROLE_MENU_ACCESS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'projects', 'reports', 'documents', 'team', 'news', 'submissions', 'faq', 'newsletter', 'users'],
  charge_communication: ['dashboard', 'projects', 'reports', 'documents', 'team', 'news', 'submissions', 'faq', 'newsletter'],
  chef_projet: ['dashboard', 'projects', 'reports', 'documents', 'team', 'news', 'submissions', 'faq', 'newsletter'],
  partenaire: ['dashboard', 'projects', 'reports', 'documents', 'team', 'news'],
  membre: ['dashboard', 'projects', 'reports', 'documents', 'team', 'news', 'faq'],
};

const ALL_MENU_ITEMS = [
  { id: 'dashboard', path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', path: '/admin/projects', label: 'Projets', icon: FolderKanban },
  { id: 'reports', path: '/admin/reports', label: 'Rapports', icon: FileText },
  { id: 'documents', path: '/admin/documents', label: 'Documents', icon: File },
  { id: 'team', path: '/admin/team', label: 'Équipe', icon: Users },
  { id: 'news', path: '/admin/news', label: 'Actualités', icon: Newspaper },
  { id: 'submissions', path: '/admin/submissions', label: 'Candidatures', icon: Mail },
  { id: 'faq', path: '/admin/faq', label: 'FAQ', icon: HelpCircle },
  { id: 'newsletter', path: '/admin/newsletter', label: 'Newsletter', icon: Mail },
  { id: 'users', path: '/admin/users', label: 'Utilisateurs', icon: UserCog },
];

const AdminLayout: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { role, userId } = useUserRole();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications(userId);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Profile editing state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/admin/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch unread messages count
  useEffect(() => {
    if (userId) {
      fetchUnreadMessageCount();

      // Subscribe to changes in discussion_messages
      const channel = supabase
        .channel('global_unread_messages')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'discussion_messages'
        }, () => {
          fetchUnreadMessageCount();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [userId]);

  const fetchUnreadMessageCount = async () => {
    if (!userId) return;
    try {
      const { count, error } = await supabase
        .from('discussion_messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (!error) {
        setUnreadMessages(count || 0);
      }
    } catch (err) {
      // Quiet fail
    }
  };

  // Route Protection Logic
  useEffect(() => {
    if (role && location.pathname.startsWith('/admin')) {
      const currentPathId = ALL_MENU_ITEMS.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))?.id;
      if (currentPathId) {
        const allowedIds = ROLE_MENU_ACCESS[role];
        if (allowedIds && !allowedIds.includes(currentPathId)) {
          navigate('/admin'); // Redirect to dashboard if unauthorized
        }
      }
    }
  }, [role, location.pathname, navigate]);

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (!error && data) {
      setProfile(data);
    }
  };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/admin/login');
    } else {
      setUser(session.user);
      fetchProfile(session.user.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Un email de confirmation a été envoyé à votre nouvelle adresse.' });
      setIsEditingEmail(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setProfileLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès.' });
      setIsEditingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };


  const menuItems = useMemo(() => {
    if (!role) return ALL_MENU_ITEMS;
    const allowedIds = ROLE_MENU_ACCESS[role] || ROLE_MENU_ACCESS.membre;
    return ALL_MENU_ITEMS.filter(item => allowedIds.includes(item.id));
  }, [role]);

  // Handle responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-green-800 text-white transform transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full'
        }`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-green-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-green-800 font-bold text-xl">D</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight">DDB Admin</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                className={`flex items-center px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${isActive
                  ? 'bg-green-700 text-white shadow-inner'
                  : 'text-green-100 hover:bg-green-700/50 hover:text-white'
                  }`}
              >
                <Icon size={18} className="mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-green-700 bg-green-800/50 backdrop-blur-sm">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-red-100 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition text-sm font-medium"
          >
            <LogOut size={18} className="mr-3" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-green-600 transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-700 hidden md:block">
              {menuItems.find(item => location.pathname === item.path)?.label || 'Administration'}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-all relative"
              >
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
                <i className="fas fa-bell text-xl"></i>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-xs text-green-600 hover:underline font-medium"
                      >
                        Tout marquer
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center text-gray-400">
                        <i className="fas fa-bell-slash text-3xl mb-2 opacity-20"></i>
                        <p className="text-sm">Aucune notification</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.read) markAsRead(n.id);
                              if (n.link) navigate(n.link);
                              setNotificationsOpen(false);
                            }}
                            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative ${!n.read ? 'bg-green-50/30' : ''}`}
                          >
                            {!n.read && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-green-500 rounded-r-full"></div>}
                            <p className="text-xs font-bold text-gray-800 mb-1">{n.title}</p>
                            <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-[10px] text-gray-400">
                                {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {n.actor_name && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded italic">
                                  Par {n.actor_name}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Trigger */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-3 pl-4 border-l border-gray-100 hover:bg-gray-50 py-1 transition-all group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800 leading-none mb-1 group-hover:text-green-600 transition-colors">
                  {profile?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] font-bold text-white bg-green-600 px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                  {role?.replace('_', ' ')}
                </p>
              </div>
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold border-2 border-green-200 transition-transform group-hover:scale-105">
                {(profile?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-6 w-full max-w-full overflow-x-hidden box-border">
          <Outlet context={{ role, userId }} />
        </main>

        {/* Floating Discussion Button */}
        <button
          onClick={() => setDiscussionOpen(true)}
          className="fixed bottom-6 right-6 z-[55] bg-green-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all group border-2 border-white"
          title="Ouvrir la discussion"
        >
          <div className="relative">
            <MessageSquare size={24} />
            {unreadMessages > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </div>
        </button>

        {/* Discussion Sidebar */}
        <DiscussionSidebar
          isOpen={discussionOpen}
          onClose={() => setDiscussionOpen(false)}
          userId={userId || ''}
        />
      </div>

      {/* Profile Slide-over Modal */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isProfileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsProfileOpen(false)}
        />

        {/* Modal Panel */}
        <div
          className={`absolute right-0 inset-y-0 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-500 ease-in-out ${isProfileOpen ? 'translate-x-0' : 'translate-x-full'
            } flex flex-col`}
        >
          <div className="p-6 bg-green-800 text-white relative">
            <button
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <div className="mt-4 flex flex-col items-center">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full border-4 border-white/30 flex items-center justify-center text-4xl font-bold mb-4 shadow-xl">
                {(profile?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <h2 className="text-xl font-bold">{profile?.full_name || 'Chargement...'}</h2>
              <p className="text-green-200 text-sm font-medium">{role?.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Informations</h3>
              <div className="space-y-4">
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:text-green-600 transition-colors">
                        <Mail size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Email</p>
                        <p className="text-sm font-semibold text-gray-800">{user?.email}</p>
                      </div>
                    </div>
                    {!isEditingEmail && (
                      <button
                        onClick={() => { setIsEditingEmail(true); setNewEmail(user?.email || ''); }}
                        className="text-xs text-green-600 font-bold hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </div>

                  {isEditingEmail && (
                    <form onSubmit={handleUpdateEmail} className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="Nouveau email"
                        required
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={profileLoading}
                          className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                          {profileLoading ? 'Envoi...' : 'Confirmer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingEmail(false)}
                          className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200"
                        >
                          Annuler
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="flex items-center gap-3 group">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:text-green-600 transition-colors">
                    <UserCog size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Rôle Système</p>
                    <p className="text-sm font-semibold text-gray-800 uppercase tracking-tight">{role?.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Sécurité</h3>
              {message && (
                <div className={`p-3 rounded-lg text-xs font-medium mb-4 animate-in fade-in zoom-in ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                  {message.text}
                </div>
              )}

              {!isEditingPassword ? (
                <button
                  onClick={() => setIsEditingPassword(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-green-50 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3 text-gray-700 font-semibold group-hover:text-green-700">
                    <i className="fas fa-key text-gray-400 group-hover:text-green-500"></i>
                    <span>Changer le mot de passe</span>
                  </div>
                  <i className="fas fa-chevron-right text-xs text-gray-300"></i>
                </button>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-3 animate-in fade-in slide-in-from-right-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Nouveau mot de passe"
                    required
                    minLength={6}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Confirmer le mot de passe"
                    required
                    minLength={6}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                    >
                      {profileLoading ? 'Mise à jour...' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPassword(false)}
                      className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-xs font-bold hover:bg-gray-200"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={handleLogout}
              className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
            >
              <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
              Déconnexion du compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
