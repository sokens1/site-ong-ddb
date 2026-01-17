
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ActionsPage from './pages/ActionsPage';
import NewsPage from './pages/NewsPage';
import ArticlePage from './pages/ArticlePage';
import JoinPage from './pages/JoinPage';
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

// Others
import ContributionsAdmin from './pages/admin/ContributionsAdmin';
import './index.css';

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;