import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';

// Core Systems
import { useSystemBoot } from './hooks/useSystemBoot';
import { useProjectManager } from './hooks/useProjectManager';

// Stores
import { usePlaybackStore } from './store/usePlaybackStore';
import { useArrangementStore } from './store/useArrangementStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';
import { useAuthStore } from './store/useAuthStore';
import { usePanelsStore } from './store/usePanelsStore';

// Providers
import { SystemProvider } from './providers/SystemProvider';
import { useToast } from './providers/ToastProvider';

// UI Components
import StartupScreen from './components/StartUpScreen';
import LoadingScreen from './components/layout/LoadingScreen';
import TopToolbar from './features/toolbars/TopToolbar';
import MainToolbar from './features/toolbars/MainToolbar';
import WorkspacePanel from './layout/WorkspacePanel';
import Taskbar from './features/taskbar/Taskbar';
import InstrumentEditorPanel from './features/instrument_editor/InstrumentEditorPanel';
import { PerformanceOverlay } from './components/debug/PerformanceOverlay';
import ExportPanel from './components/ExportPanel';
import AudioExportPanel from './components/AudioExportPanel';
import { InstrumentPickerWrapper } from './components/InstrumentPickerWrapper';
import AuthScreen from './components/auth/AuthScreen';
import LoginPrompt from './components/common/LoginPrompt';
import WelcomeScreen from './components/common/WelcomeScreen';
import NavigationHeader from './components/layout/NavigationHeader';
import ProjectLoadingScreen from './components/common/ProjectLoadingScreen';
import ProjectTitleModal from './components/common/ProjectTitleModal';

// Styles
import './components/common/WelcomeScreen.css';
import './pages/AdminPanel.css';
import './pages/ProjectsPage.css';
import './components/common/QuickAuthModal.css';
import './components/media/MediaApp.css';

// Lazy Components
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const MediaPanel = lazy(() => import('./features/media_panel/MediaPanel'));
const RenderPage = lazy(() => import('./pages/RenderPage'));

// Services
import { authService } from './services/authService';
import { projectService } from './services/projectService';

// Development Helpers
if (import.meta.env.DEV) {
  // console.log('🚀 Dev mode active');
}

// DAW Component
function DAWApp() {
  const location = useLocation();

  // ✅ SYSTEM BOOT HOOK
  const { engineStatus, engineError, initializeAudioSystem, audioEngineRef } = useSystemBoot();

  // ✅ PROJECT MANAGER HOOK
  const {
    currentProjectId,
    currentProjectTitle,
    isLoadingProject,
    loadingProjectTitle,
    saveStatus,
    lastSavedAt,
    showLoginPrompt,
    showProjectTitleModal,
    handleProjectSelect,
    handleNewProject,
    handleSave,
    handleEditTitle,
    handleTitleSave,
    setShowLoginPrompt,
    setShowProjectTitleModal
  } = useProjectManager(engineStatus, initializeAudioSystem);

  // Export Panel State (Local UI)
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const isAudioExportPanelOpen = usePanelsStore(state => state.isAudioExportPanelOpen);
  const setAudioExportPanelOpen = usePanelsStore(state => state.setAudioExportPanelOpen);

  // Keyboard Shortcuts (Export Only - Save handled by hook)
  useEffect(() => {
    if (engineStatus === 'ready') {
      const handleKeyDown = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
          e.preventDefault();
          setIsExportPanelOpen(prev => !prev);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [engineStatus]);

  // Resume On Return Effect
  useEffect(() => {
    if (location.pathname.startsWith('/daw') && engineStatus === 'ready' && audioEngineRef.current) {
      const resumeAudioContext = async () => {
        const engine = audioEngineRef.current;
        if (engine?.audioContext && engine.audioContext.state === 'suspended') {
          try {
            await engine.audioContext.resume();
            console.log('✅ AudioContext resumed after returning to DAW route');
          } catch (error) {
            console.warn('⚠️ Failed to resume AudioContext:', error);
          }
        }
      };
      resumeAudioContext();
    }
  }, [location.pathname, engineStatus, audioEngineRef]);

  const renderContent = useCallback(() => {
    switch (engineStatus) {
      case 'initializing':
        return <LoadingScreen />;
      case 'error':
        return (
          <div className="w-screen h-screen flex items-center justify-center bg-red-900 text-white">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Bir Hata Oluştu</h2>
              <p className="mb-4">{engineError}</p>
              <button onClick={initializeAudioSystem} className="bg-white text-black px-4 py-2 rounded">
                Tekrar Dene
              </button>
            </div>
          </div>
        );
      case 'ready':
        return (
          <>
            {isLoadingProject && (
              <ProjectLoadingScreen
                projectTitle={loadingProjectTitle}
                message="Proje verileri yükleniyor, lütfen bekleyin..."
              />
            )}
            <NavigationHeader
              currentProjectId={currentProjectId}
              currentProjectTitle={currentProjectTitle}
              onProjectSelect={handleProjectSelect}
              onNewProject={handleNewProject}
              onEditTitle={handleEditTitle}
            />
            {/* Modals outside app container */}
            <ProjectTitleModal
              isOpen={showProjectTitleModal}
              onClose={() => setShowProjectTitleModal(false)}
              currentTitle={currentProjectTitle}
              onSave={handleTitleSave}
            />
            <ExportPanel isOpen={isExportPanelOpen} onClose={() => setIsExportPanelOpen(false)} />
            <AudioExportPanel
              isOpen={isAudioExportPanelOpen}
              onClose={() => setAudioExportPanelOpen(false)}
            />
            <InstrumentPickerWrapper />
            <LoginPrompt
              isOpen={showLoginPrompt}
              onClose={() => setShowLoginPrompt(false)}
              onLogin={() => setShowLoginPrompt(false)}
            />

            <div
              className="app-container"
              style={{
                marginTop: '56px',
                height: 'calc(100vh - 56px)',
                opacity: isLoadingProject ? 0.3 : 1,
                pointerEvents: isLoadingProject ? 'none' : 'auto',
                transition: 'opacity 0.3s ease-out',
                overflow: 'hidden'
              }}
            >
              <TopToolbar
                onExportClick={() => setIsExportPanelOpen(true)}
                onSaveClick={() => handleSave(false)}
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
              />
              <MainToolbar />
              <main className="app-main">
                <Suspense fallback={<div>Yükleniyor...</div>}>
                  <WorkspacePanel />
                </Suspense>
              </main>
              <Taskbar />
              <InstrumentEditorPanel />
              <PerformanceOverlay performanceMonitor={audioEngineRef.current?.performanceMonitor} />
            </div>
          </>
        );
      case 'idle':
      default:
        // Handle persisted idle state
        return <StartupScreen onStart={initializeAudioSystem} />;
    }
  }, [engineStatus, engineError, initializeAudioSystem, isExportPanelOpen, isAudioExportPanelOpen, setAudioExportPanelOpen, showLoginPrompt, showProjectTitleModal, handleSave, currentProjectId, handleProjectSelect, handleNewProject, handleEditTitle, isLoadingProject, loadingProjectTitle, currentProjectTitle, saveStatus, lastSavedAt, audioEngineRef, handleTitleSave, setShowLoginPrompt, setShowProjectTitleModal]);

  return <>{renderContent()}</>;
}

// Media Component
function MediaApp() {
  return (
    <>
      <NavigationHeader />
      <div
        className="media-app"
        style={{
          marginTop: '56px',
          height: 'calc(100vh - 56px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
          <MediaPanel />
        </Suspense>
      </div>
    </>
  );
}

// Protected Route
function ProtectedRoute({ children, requireAuth = false }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}

// App Router
function AppRouter() {
  const { isAuthenticated, isGuest } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    authService.checkAuth().then((authenticated) => {
      setAuthChecked(true);
      if (authenticated) {
        try {
          const hasChosen = sessionStorage.getItem('user-has-chosen');
          if (!hasChosen || !JSON.parse(hasChosen)) setShowWelcome(true);
        } catch { setShowWelcome(true); }
      }
    }).catch(() => setAuthChecked(true));
  }, []);

  if (!authChecked) return <LoadingScreen />;

  if (showWelcome && isAuthenticated) {
    return <WelcomeScreen onChoose={() => setShowWelcome(false)} />;
  }

  return (
    <Routes>
      <Route path="/auth" element={
        isAuthenticated ? <Navigate to="/" replace /> :
          <AuthScreen onSuccess={() => {
            const hasChosen = sessionStorage.getItem('user-has-chosen');
            if (!hasChosen) setShowWelcome(true);
            else window.location.href = '/';
          }} onGuest={() => {
            authService.continueAsGuest();
            window.location.href = '/daw';
          }} />
      } />

      <Route path="/welcome" element={
        isAuthenticated ? <WelcomeScreen onChoose={() => setShowWelcome(false)} /> : <Navigate to="/auth" replace />
      } />

      <Route path="/" element={
        isAuthenticated ? (() => {
          const hasChosen = sessionStorage.getItem('user-has-chosen');
          return !hasChosen ? <Navigate to="/welcome" replace /> : <Navigate to="/daw" replace />;
        })() : isGuest ? <Navigate to="/daw" replace /> : <Navigate to="/auth" replace />
      } />

      <Route path="/daw" element={<ProtectedRoute><DAWApp /></ProtectedRoute>} />
      <Route path="/media" element={<ProtectedRoute><MediaApp /></ProtectedRoute>} />

      <Route path="/admin" element={
        <ProtectedRoute requireAuth={true}>
          <Suspense fallback={<LoadingScreen />}><AdminPanel /></Suspense>
        </ProtectedRoute>
      } />

      <Route path="/projects" element={
        <ProtectedRoute requireAuth={true}>
          <Suspense fallback={<LoadingScreen />}><ProjectsPage /></Suspense>
        </ProtectedRoute>
      } />

      <Route path="/render" element={
        <Suspense fallback={<LoadingScreen />}><RenderPage /></Suspense>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Root App Component
function App() {
  return (
    <SystemProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </SystemProvider>
  );
}

export default App;