import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { FileText, Newspaper, Users, TrendingUp, Calendar, FolderKanban } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DashboardStats {
  reports: number;
  videos: number;
  news: number;
  teamMembers: number;
  faq: number;
  submissions: number;
  newsletter: number;
  projects: {
    total: number;
    planifie: number;
    en_cours: number;
    termine: number;
  };
  totalVisits: number;
}

interface MonthlyData {
  month: string;
  submissions: number;
  newsletter: number;
}

const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
const PROJECT_COLORS = ['#9ca3af', '#3b82f6', '#10b981']; // Gray (Planifié), Blue (En cours), Green (Terminé)

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    reports: 0,
    videos: 0,
    news: 0,
    teamMembers: 0,
    faq: 0,
    submissions: 0,
    newsletter: 0,
    projects: { total: 0, planifie: 0, en_cours: 0, termine: 0 },
    totalVisits: 0
  });

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [dailyVisits, setDailyVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchMonthlyData();
    fetchDailyVisits();
  }, []);

  const fetchStats = async () => {
    try {
      const [reports, videos, news, team, faq, submissions, newsletter, projects, visits] = await Promise.all([
        supabase.from('reports').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('news').select('id', { count: 'exact', head: true }),
        supabase.from('team_members').select('id', { count: 'exact', head: true }),
        supabase.from('faq').select('id', { count: 'exact', head: true }),
        supabase.from('form_submissions').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('status'),
        supabase.from('site_visits').select('count'),
      ]);

      const projectStats = {
        total: projects.data?.length || 0,
        planifie: projects.data?.filter(p => p.status === 'planifie').length || 0,
        en_cours: projects.data?.filter(p => p.status === 'en_cours').length || 0,
        termine: projects.data?.filter(p => p.status === 'termine').length || 0,
      };

      const totalVisitsCount = visits.data?.reduce((acc, curr) => acc + (curr.count || 0), 0) || 0;

      setStats({
        reports: reports.count || 0,
        videos: videos.count || 0,
        news: news.count || 0,
        teamMembers: team.count || 0,
        faq: faq.count || 0,
        submissions: submissions.count || 0,
        newsletter: newsletter.count || 0,
        projects: projectStats,
        totalVisits: totalVisitsCount,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const { data: submissions, error: submissionsError } = await supabase
        .from('form_submissions')
        .select('created_at')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      const { data: newsletter, error: newsletterError } = await supabase
        .from('newsletter_subscribers')
        .select('created_at')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (submissionsError) {
        console.error('Error fetching submissions:', submissionsError);
      }
      if (newsletterError) {
        console.error('Error fetching newsletter:', newsletterError);
      }

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
              if (isNaN(date.getTime())) return;

              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              sixMonthsAgo.setDate(1);
              sixMonthsAgo.setHours(0, 0, 0, 0);

              const itemDate = new Date(date.getFullYear(), date.getMonth(), 1);

              if (itemDate >= sixMonthsAgo) {
                const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                const current = monthMap.get(monthKey);
                if (current) {
                  current.submissions++;
                  monthMap.set(monthKey, current);
                } else {
                  monthMap.set(monthKey, { submissions: 1, newsletter: 0 });
                }
              }
            } catch (error) {
              console.error('Error processing submission date:', error);
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
              if (isNaN(date.getTime())) return;

              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              sixMonthsAgo.setDate(1);
              sixMonthsAgo.setHours(0, 0, 0, 0);

              const itemDate = new Date(date.getFullYear(), date.getMonth(), 1);

              if (itemDate >= sixMonthsAgo) {
                const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                const current = monthMap.get(monthKey);
                if (current) {
                  current.newsletter++;
                  monthMap.set(monthKey, current);
                } else {
                  monthMap.set(monthKey, { submissions: 0, newsletter: 1 });
                }
              }
            } catch (error) {
              console.error('Error processing newsletter date:', error);
            }
          }
        });
      }

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

      setMonthlyData(monthly);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    }
  };

  const fetchDailyVisits = async () => {
    try {
      const { data } = await supabase
        .from('site_visits')
        .select('visit_date, count')
        .order('visit_date', { ascending: true })
        .limit(30);

      if (data) {
        const formatted = data.map(v => ({
          date: new Date(v.visit_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          visites: v.count
        }));
        setDailyVisits(formatted);
      }
    } catch (error) {
      console.error('Error fetching daily visits:', error);
    }
  };

  const statCards = useMemo(() => [
    { label: 'Projets', value: stats.projects.total, icon: FolderKanban, color: 'bg-blue-500', bgGradient: 'from-blue-500 to-blue-600' },
    { label: 'Rapports', value: stats.reports, icon: FileText, color: 'bg-purple-500', bgGradient: 'from-purple-500 to-purple-600' },
    { label: 'Actualités', value: stats.news, icon: Newspaper, color: 'bg-green-500', bgGradient: 'from-green-500 to-green-600' },
    { label: 'Engagement', value: stats.submissions + stats.newsletter, icon: Users, color: 'bg-pink-500', bgGradient: 'from-pink-500 to-pink-600' },
    { label: 'Membres équipe', value: stats.teamMembers, icon: Users, color: 'bg-yellow-500', bgGradient: 'from-yellow-500 to-yellow-600' },
  ], [stats]);

  const pieData = useMemo(() => [
    { name: 'Rapports', value: stats.reports },
    { name: 'Vidéos', value: stats.videos },
    { name: 'Actualités', value: stats.news },
    { name: 'FAQ', value: stats.faq },
  ].filter(d => d.value > 0), [stats]);

  const projectPieData = useMemo(() => [
    { name: 'Planifiés', value: stats.projects.planifie },
    { name: 'En cours', value: stats.projects.en_cours },
    { name: 'Terminés', value: stats.projects.termine },
  ].filter(item => item.value > 0), [stats]);

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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Cartes de statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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

          {/* Graphique des visites journalières */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Visites Journalières</h2>
              <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                <TrendingUp size={16} />
                <span>En direct</span>
              </div>
            </div>
            {dailyVisits.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyVisits}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="visites"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ fill: '#4f46e5', strokeWidth: 2, r: 4, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Visites"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500 bg-gray-50 rounded-lg">
                <p>Aucune donnée de visite pour le moment. Assurez-vous d'avoir lancé le script SQL.</p>
              </div>
            )}
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Graphique Projets */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">État des Projets</h2>
              {projectPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={projectPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {projectPieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={PROJECT_COLORS[index % PROJECT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <p>Aucun projet enregistré</p>
                </div>
              )}
            </div>

            {/* Graphique Répartition du contenu */}
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
                      label={({ name, percent, value }) => value > 0 ? `${name}: ${((percent || 0) * 100).toFixed(0)}%` : ''}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <p>Aucune donnée disponible</p>
                </div>
              )}
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
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
