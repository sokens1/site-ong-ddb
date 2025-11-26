import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { FileText, Video, Newspaper, Users, Mail, HelpCircle, TrendingUp, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface DashboardStats {
  reports: number;
  videos: number;
  news: number;
  teamMembers: number;
  faq: number;
  submissions: number;
  newsletter: number;
}

interface MonthlyData {
  month: string;
  submissions: number;
  newsletter: number;
}

const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    reports: 0,
    videos: 0,
    news: 0,
    teamMembers: 0,
    faq: 0,
    submissions: 0,
    newsletter: 0,
  });

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchMonthlyData();
  }, []);

  const fetchStats = async () => {
    try {
      const [reports, videos, news, team, faq, submissions, newsletter] = await Promise.all([
        supabase.from('reports').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('news').select('id', { count: 'exact', head: true }),
        supabase.from('team_members').select('id', { count: 'exact', head: true }),
        supabase.from('faq').select('id', { count: 'exact', head: true }),
        supabase.from('form_submissions').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        reports: reports.count || 0,
        videos: videos.count || 0,
        news: news.count || 0,
        teamMembers: team.count || 0,
        faq: faq.count || 0,
        submissions: submissions.count || 0,
        newsletter: newsletter.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      // Récupérer toutes les candidatures (sans filtre de date pour être sûr de tout récupérer)
      let submissions = null;
      let submissionsError = null;
      
      // Essayer avec tri, sinon sans tri
      const submissionsWithOrder = await supabase
        .from('form_submissions')
        .select('created_at')
        .order('created_at', { ascending: true });
      
      if (submissionsWithOrder.error) {
        // Si le tri échoue, essayer sans tri
        const submissionsNoOrder = await supabase
          .from('form_submissions')
          .select('created_at');
        submissions = submissionsNoOrder.data;
        submissionsError = submissionsNoOrder.error;
      } else {
        submissions = submissionsWithOrder.data;
        submissionsError = submissionsWithOrder.error;
      }

      // Récupérer tous les abonnés newsletter
      let newsletter = null;
      let newsletterError = null;
      
      const newsletterWithOrder = await supabase
        .from('newsletter_subscribers')
        .select('created_at')
        .order('created_at', { ascending: true });
      
      if (newsletterWithOrder.error) {
        // Si le tri échoue, essayer sans tri
        const newsletterNoOrder = await supabase
          .from('newsletter_subscribers')
          .select('created_at');
        newsletter = newsletterNoOrder.data;
        newsletterError = newsletterNoOrder.error;
      } else {
        newsletter = newsletterWithOrder.data;
        newsletterError = newsletterWithOrder.error;
      }

      if (submissionsError) {
        console.error('Error fetching submissions:', submissionsError);
      }
      if (newsletterError) {
        console.error('Error fetching newsletter:', newsletterError);
      }

      console.log('Submissions data:', submissions?.length || 0, submissions);
      console.log('Newsletter data:', newsletter?.length || 0, newsletter);

      // Grouper par mois
      const monthMap = new Map<string, { submissions: number; newsletter: number }>();
      
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      
      // Initialiser les 6 derniers mois
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthMap.set(monthKey, { submissions: 0, newsletter: 0 });
      }

      // Compter les candidatures par mois
      if (submissions && submissions.length > 0) {
        submissions.forEach((item) => {
          if (item.created_at) {
            try {
              const date = new Date(item.created_at);
              // Vérifier que la date est valide
              if (isNaN(date.getTime())) {
                console.warn('Invalid date:', item.created_at);
                return;
              }
              
              // Vérifier si la date est dans les 6 derniers mois
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              sixMonthsAgo.setDate(1); // Premier jour du mois pour une comparaison correcte
              sixMonthsAgo.setHours(0, 0, 0, 0);
              
              // Normaliser la date au premier jour du mois
              const itemDate = new Date(date.getFullYear(), date.getMonth(), 1);
              
              if (itemDate >= sixMonthsAgo) {
                const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                const current = monthMap.get(monthKey);
                if (current) {
                  current.submissions++;
                  monthMap.set(monthKey, current);
                } else {
                  // Si le mois n'est pas dans les 6 derniers, l'ajouter quand même
                  monthMap.set(monthKey, { submissions: 1, newsletter: 0 });
                }
              }
            } catch (error) {
              console.error('Error processing submission date:', item.created_at, error);
            }
          }
        });
      }

      // Compter les abonnés newsletter par mois
      if (newsletter && newsletter.length > 0) {
        newsletter.forEach((item) => {
          if (item.created_at) {
            try {
              const date = new Date(item.created_at);
              // Vérifier que la date est valide
              if (isNaN(date.getTime())) {
                console.warn('Invalid date:', item.created_at);
                return;
              }
              
              // Vérifier si la date est dans les 6 derniers mois
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              sixMonthsAgo.setDate(1); // Premier jour du mois pour une comparaison correcte
              sixMonthsAgo.setHours(0, 0, 0, 0);
              
              // Normaliser la date au premier jour du mois
              const itemDate = new Date(date.getFullYear(), date.getMonth(), 1);
              
              if (itemDate >= sixMonthsAgo) {
                const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                const current = monthMap.get(monthKey);
                if (current) {
                  current.newsletter++;
                  monthMap.set(monthKey, current);
                } else {
                  // Si le mois n'est pas dans les 6 derniers, l'ajouter quand même
                  monthMap.set(monthKey, { submissions: 0, newsletter: 1 });
                }
              }
            } catch (error) {
              console.error('Error processing newsletter date:', item.created_at, error);
            }
          }
        });
      }

      // Créer un tableau avec les 6 derniers mois dans l'ordre chronologique
      const monthly: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        const data = monthMap.get(monthKey) || { submissions: 0, newsletter: 0 };
        monthly.push({
          month: monthKey,
          submissions: data.submissions,
          newsletter: data.newsletter,
        });
      }

      console.log('Monthly data prepared:', monthly);
      console.log('Total submissions in last 6 months:', monthly.reduce((sum, m) => sum + m.submissions, 0));
      console.log('Total newsletter in last 6 months:', monthly.reduce((sum, m) => sum + m.newsletter, 0));
      setMonthlyData(monthly);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    }
  };

  const statCards = [
    { label: 'Rapports', value: stats.reports, icon: FileText, color: 'bg-purple-500', bgGradient: 'from-purple-500 to-purple-600' },
    { label: 'Vidéos', value: stats.videos, icon: Video, color: 'bg-red-500', bgGradient: 'from-red-500 to-red-600' },
    { label: 'Actualités', value: stats.news, icon: Newspaper, color: 'bg-green-500', bgGradient: 'from-green-500 to-green-600' },
    { label: 'Membres équipe', value: stats.teamMembers, icon: Users, color: 'bg-yellow-500', bgGradient: 'from-yellow-500 to-yellow-600' },
    { label: 'FAQ', value: stats.faq, icon: HelpCircle, color: 'bg-indigo-500', bgGradient: 'from-indigo-500 to-indigo-600' },
    { label: 'Candidatures', value: stats.submissions, icon: Mail, color: 'bg-pink-500', bgGradient: 'from-pink-500 to-pink-600' },
    { label: 'Newsletter', value: stats.newsletter, icon: Mail, color: 'bg-teal-500', bgGradient: 'from-teal-500 to-teal-600' },
  ];

  // Données pour le graphique en camembert
  const pieData = [
    { name: 'Rapports', value: stats.reports },
    { name: 'Vidéos', value: stats.videos },
    { name: 'Actualités', value: stats.news },
    { name: 'FAQ', value: stats.faq },
  ].filter(item => item.value > 0);

  // Données pour le graphique en barres
  const barData = [
    { name: 'Rapports', count: stats.reports },
    { name: 'Vidéos', count: stats.videos },
    { name: 'Actualités', count: stats.news },
    { name: 'FAQ', count: stats.faq },
    { name: 'Équipe', count: stats.teamMembers },
  ];

  const totalContent = stats.reports + stats.videos + stats.news + stats.faq;

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={18} />
          <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Cartes de statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`${stat.color} p-3 rounded-lg shadow-sm`}>
                        <Icon className="text-white" size={20} />
                      </div>
                      <TrendingUp className="text-gray-400" size={18} />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                  </div>
                  <div className={`h-1 bg-gradient-to-r ${stat.bgGradient}`}></div>
                </div>
              );
            })}
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Graphique en camembert */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Répartition du contenu</h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <p>Aucune donnée disponible</p>
                </div>
              )}
            </div>

            {/* Graphique en barres */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Statistiques par catégorie</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graphique linéaire pour l'évolution temporelle */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Évolution des 6 derniers mois</h2>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="submissions" stroke="#ec4899" strokeWidth={2} name="Candidatures" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="newsletter" stroke="#06b6d4" strokeWidth={2} name="Newsletter" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <p className="mb-2">Aucune donnée disponible pour les 6 derniers mois</p>
                <p className="text-sm text-gray-400">Les données apparaîtront ici une fois que des candidatures ou abonnements seront enregistrés</p>
              </div>
            )}
          </div>

          {/* Résumé global */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Contenu total</h3>
                <FileText size={24} />
              </div>
              <p className="text-4xl font-bold">{totalContent}</p>
              <p className="text-green-100 text-sm mt-2">Éléments de contenu</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Engagement</h3>
                <Users size={24} />
              </div>
              <p className="text-4xl font-bold">{stats.submissions + stats.newsletter}</p>
              <p className="text-blue-100 text-sm mt-2">Candidatures + Abonnés</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Taux de conversion</h3>
                <TrendingUp size={24} />
              </div>
              <p className="text-4xl font-bold">
                {stats.newsletter > 0 ? ((stats.submissions / stats.newsletter) * 100).toFixed(1) : '0'}%
              </p>
              <p className="text-purple-100 text-sm mt-2">Candidatures / Newsletter</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
