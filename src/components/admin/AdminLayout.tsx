import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { 
  LayoutDashboard, 
  FileText, 
  Video, 
  Newspaper, 
  Users, 
  HelpCircle, 
  Mail, 
  LogOut,
  Menu,
  X
} from 'lucide-react';

const AdminLayout: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/admin/login');
    } else {
      setUser(session.user);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    // { path: '/admin/actions', label: 'Actions', icon: FileText },
    { path: '/admin/reports', label: 'Rapports', icon: FileText },
    { path: '/admin/videos', label: 'Vidéos', icon: Video },
    { path: '/admin/news', label: 'Actualités', icon: Newspaper },
    { path: '/admin/team', label: 'Équipe', icon: Users },
    { path: '/admin/faq', label: 'FAQ', icon: HelpCircle },
    // { path: '/admin/contributions', label: 'Types de contribution', icon: FileText },
    { path: '/admin/submissions', label: 'Candidatures', icon: Mail },
    { path: '/admin/newsletter', label: 'Newsletter', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-green-800 text-white transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-green-700">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-4 py-2 text-gray-200 hover:bg-green-700 transition text-sm ${
                  isActive ? 'bg-green-700' : ''
                }`}
              >
                <Icon size={18} className="mr-2.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-3 border-t border-green-700">
          <div className="mb-2 px-4 text-xs text-gray-300 truncate">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-gray-200 hover:bg-green-700 transition text-sm"
          >
            <LogOut size={18} className="mr-2.5" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Mobile menu button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 lg:hidden bg-green-600 text-white p-2 rounded-lg"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Main content */}
      <div className="lg:ml-64">
        <div className="p-4 lg:p-6 w-full max-w-full overflow-x-hidden box-border">
          <div className="w-full max-w-full">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

