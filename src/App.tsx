import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';

// Lazy load public pages
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ActionsPage = lazy(() => import('./pages/ActionsPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));

import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AuthCallback from './pages/admin/AuthCallback';

// Admin
import UsersAdmin from './pages/admin/admin/UsersAdmin';
import TeamAdmin from './pages/admin/admin/TeamAdmin';
import SubmissionsAdmin from './pages/admin/admin/SubmissionsAdmin';

// Communication
import NewsAdmin from './pages/admin/communication/NewsAdmin';
import CreateNewsPage from './pages/admin/communication/CreateNewsPage';
import AdminArticleView from './pages/admin/communication/AdminArticleView';
import VideosAdmin from './pages/admin/communication/VideosAdmin';
import EditVideoPage from './pages/admin/communication/EditVideoPage';
import NewsletterAdmin from './pages/admin/communication/NewsletterAdmin';
import FaqAdmin from './pages/admin/communication/FaqAdmin';

// Chef Projet
import ProjectsAdmin from './pages/admin/chefproject/ProjectsAdmin';
import ProjectDetailsPage from './pages/admin/chefproject/ProjectDetailsPage';
import EditProjectPage from './pages/admin/chefproject/EditProjectPage';
import ReportsAdmin from './pages/admin/chefproject/ReportsAdmin';
import ActionsAdmin from './pages/admin/chefproject/ActionsAdmin';
import EditActionPage from './pages/admin/chefproject/EditActionPage';

// Partner
import DocumentsAdmin from './pages/admin/partner/DocumentsAdmin';

// New modules
import DonationsAdmin from './pages/admin/donations/DonationsAdmin';
import EventsAdmin from './pages/admin/events/EventsAdmin';
import CreateEventPage from './pages/admin/events/CreateEventPage';

// Others
import ContributionsAdmin from './pages/admin/ContributionsAdmin';
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

  const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <Router>
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
    </Router>
  );
}

export default App;