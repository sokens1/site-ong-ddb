import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';

// ── Suspense fallback (outside App to keep a stable reference) ───────────────
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Error boundary so a crashed lazy page shows an error, not infinite spinner
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.error('AppErrorBoundary caught:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
          <p className="text-gray-600 font-semibold">Une erreur est survenue.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-6 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load public pages
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ActionsPage = lazy(() => import('./pages/ActionsPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));

// Admin — lazy-loaded so they are excluded from the main bundle
const AdminLogin     = lazy(() => import('./pages/AdminLogin'));
const AdminLayout    = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AuthCallback   = lazy(() => import('./pages/admin/AuthCallback'));

const UsersAdmin       = lazy(() => import('./pages/admin/admin/UsersAdmin'));
const TeamAdmin        = lazy(() => import('./pages/admin/admin/TeamAdmin'));
const SubmissionsAdmin = lazy(() => import('./pages/admin/admin/SubmissionsAdmin'));

const NewsAdmin        = lazy(() => import('./pages/admin/communication/NewsAdmin'));
const CreateNewsPage   = lazy(() => import('./pages/admin/communication/CreateNewsPage'));
const AdminArticleView = lazy(() => import('./pages/admin/communication/AdminArticleView'));
const VideosAdmin      = lazy(() => import('./pages/admin/communication/VideosAdmin'));
const EditVideoPage    = lazy(() => import('./pages/admin/communication/EditVideoPage'));
const NewsletterAdmin  = lazy(() => import('./pages/admin/communication/NewsletterAdmin'));
const FaqAdmin         = lazy(() => import('./pages/admin/communication/FaqAdmin'));

const ProjectsAdmin    = lazy(() => import('./pages/admin/chefproject/ProjectsAdmin'));
const ProjectDetailsPage = lazy(() => import('./pages/admin/chefproject/ProjectDetailsPage'));
const EditProjectPage  = lazy(() => import('./pages/admin/chefproject/EditProjectPage'));
const ReportsAdmin     = lazy(() => import('./pages/admin/chefproject/ReportsAdmin'));
const ActionsAdmin     = lazy(() => import('./pages/admin/chefproject/ActionsAdmin'));
const EditActionPage   = lazy(() => import('./pages/admin/chefproject/EditActionPage'));

const DocumentsAdmin   = lazy(() => import('./pages/admin/partner/DocumentsAdmin'));

const DonationsAdmin   = lazy(() => import('./pages/admin/donations/DonationsAdmin'));
const EventsAdmin      = lazy(() => import('./pages/admin/events/EventsAdmin'));
const CreateEventPage  = lazy(() => import('./pages/admin/events/CreateEventPage'));
const ScanPage         = lazy(() => import('./pages/admin/events/ScanPage'));

const ContributionsAdmin = lazy(() => import('./pages/admin/ContributionsAdmin'));

import { supabase } from './supabaseClient';

function App() {
  React.useEffect(() => {
    trackVisit();
  }, []);

  const trackVisit = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Essayer d'insérer ou d'incrémenter le compteur pour aujourd'hui
      const { error } = await supabase.rpc('increment_visit', { d: today });

      if (error) {
        // Si la fonction RPC n'existe pas, utiliser une approche directe simplifiée
        const { data: existing } = await supabase
          .from('site_visits')
          .select('count')
          .eq('visit_date', today)
          .single();

        if (existing) {
          await supabase
            .from('site_visits')
            .update({ count: (existing.count || 0) + 1 })
            .eq('visit_date', today);
        } else {
          await supabase
            .from('site_visits')
            .insert([{ visit_date: today, count: 1 }]);
        }
      }
    } catch (err) {
      console.error('Error tracking visit:', err);
    }
  };

  return (
    <Router>
      <AppErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          <div className="bg-gray-50">
            <Header />
            <HomePage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/about" element={
          <div className="bg-gray-50">
            <Header />
            <AboutPage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/actions" element={
          <div className="bg-gray-50">
            <Header />
            <ActionsPage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/news" element={
          <div className="bg-gray-50">
            <Header />
            <NewsPage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/article/:id" element={
          <div className="bg-gray-50">
            <Header />
            <ArticlePage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/join" element={
          <div className="bg-gray-50">
            <Header />
            <JoinPage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/events/:id" element={
          <div className="bg-gray-50">
            <Header />
            <EventDetailPage />
            <Footer />
            <BackToTop />
          </div>
        } />
        <Route path="/events" element={
          <div className="bg-gray-50">
            <Header />
            <EventsPage />
            <Footer />
            <BackToTop />
          </div>
        } />

        {/* Auth callback route - must be before protected routes */}
        <Route path="/admin/auth/callback" element={<AuthCallback />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="actions" element={<ActionsAdmin />} />
          <Route path="actions/create" element={<EditActionPage />} />
          <Route path="actions/edit/:id" element={<EditActionPage />} />
          <Route path="projects" element={<ProjectsAdmin />} />
          <Route path="projects/:id" element={<ProjectDetailsPage />} />
          <Route path="projects/create" element={<EditProjectPage />} />
          <Route path="projects/edit/:id" element={<EditProjectPage />} />
          <Route path="reports" element={<ReportsAdmin />} />
          <Route path="videos" element={<VideosAdmin />} />
          <Route path="videos/create" element={<EditVideoPage />} />
          <Route path="videos/edit/:id" element={<EditVideoPage />} />
          <Route path="news" element={<NewsAdmin />} />
          <Route path="news/create" element={<CreateNewsPage />} />
          <Route path="news/edit/:id" element={<CreateNewsPage />} />
          <Route path="news/view/:id" element={<AdminArticleView />} />
          <Route path="team" element={<TeamAdmin />} />
          <Route path="faq" element={<FaqAdmin />} />
          <Route path="contributions" element={<ContributionsAdmin />} />
          <Route path="submissions" element={<SubmissionsAdmin />} />
          <Route path="donations" element={<DonationsAdmin />} />
          <Route path="events" element={<EventsAdmin />} />
          <Route path="events/create" element={<CreateEventPage />} />
          <Route path="events/edit/:id" element={<CreateEventPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="newsletter" element={<NewsletterAdmin />} />
          <Route path="documents" element={<DocumentsAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
        </Route>

        {/* Route catch-all pour les pages non trouvées */}
        <Route path="*" element={
          <div className="bg-gray-50 min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
              <p className="text-gray-600 mb-4">Page non trouvée</p>
              <a href="/" className="text-green-600 hover:text-green-700 underline">
                Retour à l'accueil
              </a>
            </div>
          </div>
        } />
      </Routes>
      </Suspense>
      </AppErrorBoundary>
    </Router>
  );
}

export default App;