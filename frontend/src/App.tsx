import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Public pages
import LandingPage from './pages/LandingPage';
import ExplorePage from './pages/ExplorePage';
import AuthPage from './pages/AuthPage';

// Workspace pages (protected)
import Dashboard from './pages/Dashboard';
import CreateStudio from './pages/CreateStudio';
import LearnStudio from './pages/LearnStudio';
import ImageEditor from './pages/ImageEditor';
import ImagineCanvas from './pages/ImagineCanvas';
import StoryBookStudio from './pages/StoryBookStudio';
import AskYourImage from './pages/AskYourImage';
import VoiceTranslation from './pages/VoiceTranslation';
import Gallery from './pages/Gallery';
import ProfileSettings from './pages/ProfileSettings';
import ModelPerformance from './pages/ModelPerformance';
import TrainingDatasets from './pages/TrainingDatasets';
import AdminDashboard from './pages/AdminDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/*" element={<AuthPage />} />

      {/* Protected workspace routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/create" element={<ProtectedRoute><CreateStudio /></ProtectedRoute>} />
      <Route path="/learn" element={<ProtectedRoute><LearnStudio /></ProtectedRoute>} />
      <Route path="/edit" element={<ProtectedRoute><ImageEditor /></ProtectedRoute>} />
      <Route path="/canvas" element={<ProtectedRoute><ImagineCanvas /></ProtectedRoute>} />
      <Route path="/storybook" element={<ProtectedRoute><StoryBookStudio /></ProtectedRoute>} />
      <Route path="/ask-image" element={<ProtectedRoute><AskYourImage /></ProtectedRoute>} />
      <Route path="/voice" element={<ProtectedRoute><VoiceTranslation /></ProtectedRoute>} />
      <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
      <Route path="/research" element={<ProtectedRoute><ModelPerformance /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><TrainingDatasets /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
