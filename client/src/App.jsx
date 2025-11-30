import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo, lazy } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';

// Core Systems
import { NativeAudioEngine } from './lib/core/NativeAudioEngine';
import { AudioContextService } from './lib/services/AudioContextService';
import { visualizationEngine } from './lib/visualization/VisualizationEngine';
import TimelineControllerSingleton from './lib/core/TimelineControllerSingleton';
import TransportManagerSingleton from './lib/core/TransportManagerSingleton';

// Stores
import { usePlaybackStore } from './store/usePlaybackStore';
import { useArrangementStore } from './store/useArrangementStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';
import { useAuthStore } from './store/useAuthStore';

// UI Components
import StartupScreen from './components/StartUpScreen';
import LoadingScreen from './components/layout/LoadingScreen';
import TopToolbar from './features/toolbars/TopToolbar';
import MainToolbar from './features/toolbars/MainToolbar';
import WorkspacePanel from './layout/WorkspacePanel';
import { ThemeProvider } from './components/ThemeProvider';
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
import { ToastContainer } from './components/common/Toast';
import ProjectTitleModal from './components/common/ProjectTitleModal';
import { usePanelsStore } from './store/usePanelsStore';

// ✅ CODE SPLITTING: Lazy load pages and heavy components
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const MediaPanel = lazy(() => import('./features/media_panel/MediaPanel'));
const RenderPage = lazy(() => import('./pages/RenderPage'));
import './components/common/WelcomeScreen.css';
import './pages/AdminPanel.css';
import './pages/ProjectsPage.css';
import './components/common/QuickAuthModal.css';
import './components/media/MediaApp.css';

// Services
import { authService } from './services/authService';
import { projectService } from './services/projectService';

// ENUMs and Constants
import { PLAYBACK_STATES } from './config/constants';

// ✅ PERFORMANCE: Load performance helpers in development
if (import.meta.env.DEV) {
  /*import('./utils/performanceHelpers').then(() => {
    console.log('🚀 Performance helpers loaded! Try: window.performanceHelpers.runPerformanceTest()');
  });*/

  /* ⚡ WASM: Load WASM helpers
  import('./utils/wasmHelpers').then(() => {
    console.log('⚡ WASM helpers loaded! Try: window.wasm.quickBenchmark()');
  });*/

  /* 🎛️ PHASE 3: UnifiedMixer integrated into production! Manual tests available.
  import('./lib/core/UnifiedMixerDemo.js').then(() => {
    console.log('🎛️ UnifiedMixer: Running in production (manual tests: window.demo.help())');
  }).catch(() => {});*/
}

// DAW Component (existing App logic)
function DAWApp() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // ✅ UX IMPROVEMENT: Persist engine status across route changes
  // Check if engine was already initialized in this session
  const getInitialEngineStatus = () => {
    // Check sessionStorage for persisted engine status
    const persistedStatus = sessionStorage.getItem('dawg_engine_status');
    if (persistedStatus === 'ready') {
      // Verify engine actually exists
      const existingEngine = AudioContextService.getAudioEngine();
      if (existingEngine && existingEngine.audioContext && existingEngine.audioContext.state !== 'closed') {
        return 'ready';
      }
    }
    return 'idle';
  };
  
  const [engineStatus, setEngineStatus] = useState(getInitialEngineStatus);
  const [autoStartInProgress, setAutoStartInProgress] = useState(false);
  const [engineError, setEngineError] = useState(null);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  // ✅ FIX: Get modal states from global store (reactive)
  const isAudioExportPanelOpen = usePanelsStore(state => state.isAudioExportPanelOpen);
  const setAudioExportPanelOpen = usePanelsStore(state => state.setAudioExportPanelOpen);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showProjectTitleModal, setShowProjectTitleModal] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [templateInitialized, setTemplateInitialized] = useState(false); // ✅ FIX: Track if template has been initialized
  const [isLoadingProject, setIsLoadingProject] = useState(false); // ✅ FIX: Track project loading state
  const [loadingProjectTitle, setLoadingProjectTitle] = useState(null); // ✅ FIX: Track project title during loading
  const [projectLoadAttempted, setProjectLoadAttempted] = useState(false); // ✅ FIX: Track if project load was attempted to prevent duplicate loads
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [currentProjectTitle, setCurrentProjectTitle] = useState('Untitled Project');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const hasUnsavedChangesRef = useRef(false);
  const audioEngineRef = useRef(null);
  const { isGuest, isAuthenticated, user } = useAuthStore();
  const authSessionRef = useRef(null);

  const audioEngineCallbacks = useMemo(() => ({
    setPlaybackState: (state) => {},
    setTransportPosition: usePlaybackStore.getState().setTransportPosition,
  }), []);

  const storeGetters = useMemo(() => ({
    getInstruments: () => useInstrumentsStore.getState().instruments,
    getActivePatternId: () => useArrangementStore.getState().activePatternId,
    getBPM: () => usePlaybackStore.getState().bpm,
    getMixerTracks: () => useMixerStore.getState().mixerTracks
  }), []);

  const resetWorkspaceState = useCallback((reason = 'auth-change') => {
    console.log(`🔄 Resetting workspace state due to ${reason}`);
    setProjectLoadAttempted(false);
    setTemplateInitialized(false);
    setCurrentProjectId(null);
    setCurrentProjectTitle('Untitled Project');
    setSaveStatus('saved');
    setLastSavedAt(null);
    hasUnsavedChangesRef.current = false;
    setIsLoadingProject(false);
    setLoadingProjectTitle(null);

    import('./lib/project/ProjectSerializer.js')
      .then(({ ProjectSerializer }) => ProjectSerializer.clearAll())
      .catch((error) => console.warn('⚠️ Failed to clear workspace state:', error));
  }, []);

  const prepareEmptyWorkspace = useCallback(
    async ({ loadingTitle = 'Yeni proje hazırlanıyor...', markUnsaved = true } = {}) => {
      try {
        setIsLoadingProject(true);
        setLoadingProjectTitle(loadingTitle);
        const { ProjectSerializer } = await import('./lib/project/ProjectSerializer.js');
        await ProjectSerializer.clearAll();
        const template = ProjectSerializer.createEmptyProjectTemplate();
        await ProjectSerializer.deserialize(template);
        setCurrentProjectId(null);
        setCurrentProjectTitle('Untitled Project');
        setTemplateInitialized(true);
        setSaveStatus(markUnsaved ? 'unsaved' : 'saved');
        hasUnsavedChangesRef.current = markUnsaved;
        if (!markUnsaved) {
          setLastSavedAt(new Date());
        }
      } catch (error) {
        console.error('❌ Failed to prepare empty workspace:', error);
      } finally {
        setIsLoadingProject(false);
        setLoadingProjectTitle(null);
      }
    },
    []
  );

  const loadDefaultWorkspace = useCallback(async () => {
    try {
      setIsLoadingProject(true);
      setLoadingProjectTitle('Çalışma alanı yükleniyor...');
      const loadedProject = await projectService.loadOrCreateFirstProject();
      if (loadedProject?.id) {
        setCurrentProjectId(loadedProject.id);
        setCurrentProjectTitle(loadedProject.title || 'Untitled Project');
        setTemplateInitialized(true);
        setSaveStatus('saved');
        hasUnsavedChangesRef.current = false;
        setLastSavedAt(loadedProject.updatedAt ? new Date(loadedProject.updatedAt) : new Date());
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('project', loadedProject.id);
        window.history.replaceState({}, '', currentUrl.toString());
        return;
      }
      await prepareEmptyWorkspace({ loadingTitle: 'Yeni proje hazırlanıyor...', markUnsaved: true });
    } catch (error) {
      console.error('❌ Failed to load default workspace:', error);
      await prepareEmptyWorkspace({ loadingTitle: 'Yeni proje hazırlanıyor...', markUnsaved: true });
    } finally {
      setIsLoadingProject(false);
      setLoadingProjectTitle(null);
    }
  }, [prepareEmptyWorkspace]);

  // Handle project selection/loading
  // ✅ FIX: Memoize onEditTitle callback to prevent re-renders and ensure immediate state update
  const handleEditTitle = useCallback(() => {
    console.log('📝 handleEditTitle called, setting showProjectTitleModal to true');
    setShowProjectTitleModal(true);
  }, []);

  const handleProjectSelect = useCallback(async (projectId) => {
    try {
      console.log('📂 Loading project:', projectId);
      
      // ✅ FIX: Show loading screen
      setIsLoadingProject(true);
      setLoadingProjectTitle(null); // Will be set when project is loaded
      
      // ✅ FIX: Set projectLoadAttempted BEFORE loading to prevent useEffect from interfering
      // Use functional update to avoid dependency on projectLoadAttempted
      setProjectLoadAttempted(prev => {
        if (!prev) {
          // Only set to true if it was false, to prevent unnecessary re-renders
          return true;
        }
        return prev;
      });
      
      // Reset flags when switching projects
      setTemplateInitialized(false);
      
      // ✅ FIX: Load project - loadProject() handles clearAll() and deserialize internally
      // No need to call clearAll() here to avoid double-clearing
      const project = await projectService.loadProject(projectId);
      const projectTitle = project.title || 'Untitled Project';
      setLoadingProjectTitle(projectTitle);
      setCurrentProjectTitle(projectTitle);
      setCurrentProjectId(project.id);
      setTemplateInitialized(true);
      setSaveStatus('saved');
      setLastSavedAt(project.updatedAt ? new Date(project.updatedAt) : new Date());
      hasUnsavedChangesRef.current = false;
      
      // ✅ FIX: Update URL to reflect selected project (only if different from current)
      // Use window.history to avoid triggering searchParams change (which would recreate handleProjectSelect)
      const currentUrl = new URL(window.location.href);
      const currentProjectIdFromUrl = currentUrl.searchParams.get('project');
      if (currentProjectIdFromUrl !== projectId) {
        currentUrl.searchParams.set('project', projectId);
        window.history.replaceState({}, '', currentUrl.toString());
        // Note: We don't update searchParams state here to avoid recreating handleProjectSelect
        // The URL is updated, but searchParams state will sync on next render if needed
      }
      
      console.log('✅ Project loaded:', project.id);
    } catch (error) {
      console.error('❌ Failed to load project:', error);
      // ✅ FIX: Reset projectLoadAttempted on error to allow retry
      setProjectLoadAttempted(false);
      throw error;
    } finally {
      // ✅ FIX: Hide loading screen
      setIsLoadingProject(false);
      setLoadingProjectTitle(null);
    }
  }, []); // ✅ FIX: Empty deps - handleProjectSelect is stable, projectLoadAttempted prevents useEffect from interfering

  // ✅ FIX: Handle project loading from URL query parameter or default project
  useEffect(() => {
    // Only run if audio engine is ready, user is authenticated, template not initialized, and project load not attempted
    // ✅ FIX: Also check if we're already loading a project manually (isLoadingProject)
    if (engineStatus === 'ready' && isAuthenticated && !isGuest && !templateInitialized && !projectLoadAttempted && !isLoadingProject) {
      const loadProjectFromUrlOrDefault = async () => {
        try {
          // ✅ FIX: Set projectLoadAttempted FIRST to prevent re-running
          setProjectLoadAttempted(true);
          const projectIdFromUrl = searchParams.get('project');
          
          if (projectIdFromUrl && projectIdFromUrl !== currentProjectId) {
            // Load project from URL (only if different from current)
            console.log('📂 Loading project from URL:', projectIdFromUrl);
            // ✅ FIX: Call handleProjectSelect directly (it's stable due to empty deps)
            await handleProjectSelect(projectIdFromUrl);
            return;
          }

          await loadDefaultWorkspace();
        } catch (error) {
          console.error('❌ Failed to load project:', error);
          await prepareEmptyWorkspace({ loadingTitle: 'Yeni proje hazırlanıyor...', markUnsaved: true });
          setProjectLoadAttempted(false); // ✅ FIX: Allow retry on error
        }
      };
      
      loadProjectFromUrlOrDefault();
    }
  }, [engineStatus, isAuthenticated, isGuest, templateInitialized, projectLoadAttempted, isLoadingProject, currentProjectId, searchParams, handleProjectSelect, loadDefaultWorkspace, prepareEmptyWorkspace]);

  useEffect(() => {
    const authKey = isGuest ? 'guest' : (user?.id ? `user:${user.id}` : 'user');
    const prevAuthKey = authSessionRef.current;

    if (prevAuthKey === null) {
      authSessionRef.current = authKey;
      return;
    }

    if (prevAuthKey === authKey) {
      return;
    }

    authSessionRef.current = authKey;

    const wasGuest = prevAuthKey === 'guest';
    const isNowGuest = authKey === 'guest';
    const prevUserId = prevAuthKey?.startsWith('user:') ? prevAuthKey.split(':')[1] : null;
    const nextUserId = authKey?.startsWith('user:') ? authKey.split(':')[1] : null;

    if (!wasGuest && isNowGuest) {
      resetWorkspaceState('logout');
      return;
    }

    if (!wasGuest && !isNowGuest && prevUserId !== nextUserId) {
      resetWorkspaceState('account-switch');
      return;
    }

    if (wasGuest && !isNowGuest) {
      if (!currentProjectId) {
        setSaveStatus('unsaved');
        hasUnsavedChangesRef.current = true;
      }
      return;
    }
  }, [isGuest, isAuthenticated, user, resetWorkspaceState, currentProjectId, setSaveStatus]);

  // ✅ UX IMPROVEMENT: Check for existing engine on mount
  // This prevents showing StartupScreen if engine was already initialized
  useEffect(() => {
    // Only check once on mount if status is 'idle'
    if (engineStatus === 'idle') {
      const existingEngine = AudioContextService.getAudioEngine();
      if (existingEngine && existingEngine.audioContext && existingEngine.audioContext.state !== 'closed') {
        console.log('♻️ Found existing audio engine on mount, reusing...');
        audioEngineRef.current = existingEngine;
        window.audioEngine = existingEngine;
        
        // Resume AudioContext if suspended
        const resumeIfNeeded = async () => {
          if (existingEngine.audioContext.state === 'suspended') {
            try {
              await existingEngine.resumeAudioContext();
              console.log('✅ AudioContext resumed for existing engine');
            } catch (error) {
              console.warn('⚠️ Failed to resume AudioContext:', error);
            }
          }
        };
        
        resumeIfNeeded();
        
        // Re-sync instruments to mixer
        AudioContextService._syncInstrumentsToMixerInserts().catch(err => {
          console.warn('⚠️ Failed to re-sync instruments:', err);
        });
        
        // Update status to ready
        setEngineStatus('ready');
        sessionStorage.setItem('dawg_engine_status', 'ready');
        console.log('✅ Existing audio engine restored');
      }
    }
  }, []); // Only run once on mount

  // ✅ UX IMPROVEMENT: Resume AudioContext when returning to DAW route from other panels
  useEffect(() => {
    // Only run if we're on DAW route and engine is ready
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
  }, [location.pathname, engineStatus]);

  const initializeAudioSystem = useCallback(async () => {
    if (engineStatus === 'ready' || engineStatus === 'initializing') return;

    // ✅ UX IMPROVEMENT: Check if engine already exists in AudioContextService (from previous mount)
    // This check is also done in useEffect, but we keep it here as a safety check
    const existingEngine = AudioContextService.getAudioEngine();
    if (existingEngine && existingEngine.audioContext && existingEngine.audioContext.state !== 'closed') {
      console.log('♻️ Reusing existing audio engine');
      audioEngineRef.current = existingEngine;
      window.audioEngine = existingEngine;
      
      // Ensure AudioContext is resumed
      if (existingEngine.audioContext.state === 'suspended') {
        try {
          await existingEngine.resumeAudioContext();
          console.log('✅ AudioContext resumed for existing engine');
        } catch (error) {
          console.warn('⚠️ Failed to resume AudioContext:', error);
        }
      }
      
      // ✅ CRITICAL: Re-sync instruments to mixer inserts after reusing engine
      // This ensures instrument connections are restored after panel navigation
      try {
        await AudioContextService._syncInstrumentsToMixerInserts();
        console.log('✅ Re-synced instruments to mixer inserts');
      } catch (syncError) {
        console.warn('⚠️ Failed to re-sync instruments:', syncError);
      }
      
      // Update engine status without reinitializing
      setEngineStatus('ready');
      // ✅ UX IMPROVEMENT: Persist engine status
      sessionStorage.setItem('dawg_engine_status', 'ready');
      console.log('✅ Existing audio engine ready');
      return;
    }

    setEngineStatus('initializing');
    console.log('🚀 Ses sistemi başlatılıyor...');

    try {
      const engine = new NativeAudioEngine(audioEngineCallbacks);
      await engine.initialize();
      audioEngineRef.current = engine;
      window.audioEngine = engine;

      // ✅ CRITICAL: Resume AudioContext after user interaction
      // This is required by browser autoplay policies
      try {
        await engine.resumeAudioContext();
      } catch (resumeError) {
        console.warn('⚠️ Could not resume AudioContext immediately:', resumeError);
        // Continue anyway - will resume on first playback
      }

      console.log('🎛️ Loading AudioWorklet processors...');
      // ✅ FIX: Use engine's workletManager to load processors
      if (engine.workletManager) {
        const processorConfigs = [
          { path: '/worklets/UnifiedMixerWorklet.js', name: 'unified-mixer-worklet' },
          { path: '/worklets/effects/compressor-processor.js', name: 'compressor-processor' },
          { path: '/worklets/effects/saturator-processor.js', name: 'saturator-processor' },
          { path: '/worklets/effects/multiband-eq-processor.js', name: 'multiband-eq-processor' },
          { path: '/worklets/effects/modern-reverb-processor.js', name: 'modern-reverb-processor' },
          { path: '/worklets/effects/modern-delay-processor.js', name: 'modern-delay-processor' },
        ];

        const results = await engine.workletManager.loadMultipleWorklets(processorConfigs);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');
        
        if (failed.length > 0) {
          console.warn(`⚠️ ${failed.length} processor(s) failed to load:`, 
            failed.map(r => r.reason?.message || 'Unknown error'));
        }
        
        console.log(`✅ Loaded ${successful}/${processorConfigs.length} processors`);
      } else {
        console.warn('⚠️ WorkletManager not available, processors will be loaded on demand');
      }

      // ✅ FIX: Use setAudioEngine instead of initialize
      await AudioContextService.setAudioEngine(engine);
      
      // ✅ FIX: Use init instead of initialize, pass AudioContext
      if (engine.audioContext) {
        visualizationEngine.init(engine.audioContext);
      }
      
      TimelineControllerSingleton.getInstance();
      TransportManagerSingleton.getInstance();

      setEngineStatus('ready');
      // ✅ UX IMPROVEMENT: Persist engine status
      sessionStorage.setItem('dawg_engine_status', 'ready');
      console.log('✅ Ses sistemi hazır!');
      
      // ✅ FIX: For guest users, create empty template immediately
      // For authenticated users, project loading is handled in the useEffect above
      if (isGuest && !templateInitialized && !isLoadingProject) {
        prepareEmptyWorkspace({
          loadingTitle: 'Misafir Projesi Hazırlanıyor...',
          markUnsaved: true,
        });
      }
    } catch (error) {
      console.error('❌ Ses sistemi başlatma hatası:', error);
      setEngineError(error.message || 'Bilinmeyen hata');
      setEngineStatus('error');
      // ✅ UX IMPROVEMENT: Clear persisted status on error
      sessionStorage.removeItem('dawg_engine_status');
    }
  }, [engineStatus, audioEngineCallbacks, isAuthenticated, isGuest, templateInitialized, prepareEmptyWorkspace]);

  useEffect(() => {
    if (engineStatus !== 'idle') {
      if (autoStartInProgress) {
        setAutoStartInProgress(false);
      }
      return;
    }

    let shouldAutoStart = false;
    try {
      const stored = sessionStorage.getItem('daw-auto-start');
      shouldAutoStart = stored ? JSON.parse(stored) : false;
    } catch {
      shouldAutoStart = false;
    }

    if (shouldAutoStart && !autoStartInProgress) {
      sessionStorage.removeItem('daw-auto-start');
      setAutoStartInProgress(true);
      initializeAudioSystem();
    }
  }, [engineStatus, initializeAudioSystem, autoStartInProgress]);

  // Handle save action - show login prompt if guest
  // ✅ FIX: Define handleSave BEFORE it's used in useEffect

  // Handle new project creation
  const handleNewProject = useCallback(async () => {
    try {
      console.log('📝 Creating new project...');
      
      // ✅ FIX: Show loading screen
      setIsLoadingProject(true);
      setLoadingProjectTitle('Yeni Proje Oluşturuluyor...');
      
      // Reset template flag (handleProjectSelect will handle projectLoadAttempted)
      setTemplateInitialized(false);
      // ✅ FIX: Don't reset projectLoadAttempted - handleProjectSelect will set it to true
      
      // Clear existing project data
      const { ProjectSerializer } = await import('./lib/project/ProjectSerializer.js');
      await ProjectSerializer.clearAll();
      
      // Create new empty project
      const template = ProjectSerializer.createEmptyProjectTemplate();
      
      const newProject = await projectService.createProject({
        title: 'Untitled Project',
        ...template,
      });
      
      // ✅ FIX: Validate that project was created successfully
      if (!newProject || !newProject.id) {
        throw new Error('Failed to create project: No project ID returned');
      }
      
      console.log('✅ New project created:', newProject.id);
      
      setLoadingProjectTitle('Untitled Project');
      setCurrentProjectTitle('Untitled Project');
      
      // Load the new project (this will set projectLoadAttempted to true)
      await handleProjectSelect(newProject.id);
      
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      hasUnsavedChangesRef.current = false;
      console.log('✅ New project created:', newProject.id);
    } catch (error) {
      console.error('❌ Failed to create new project:', error);
      setIsLoadingProject(false);
      setLoadingProjectTitle(null);
      // ✅ FIX: Don't reset projectLoadAttempted on error - let user retry manually
    }
  }, [handleProjectSelect]);

  // ✅ 5. TOAST NOTIFICATIONS: Show success/error messages
  const [toasts, setToasts] = useState([]);
  const [toastKey, setToastKey] = useState(0); // ✅ FIX: Force re-render with key
  const showNotification = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    // ✅ FIX: Serialize/deserialize toast to ensure React detects state change
    const serializedToast = JSON.parse(JSON.stringify(toast));
    
    // ✅ FIX: Use queueMicrotask to defer flushSync if called during render
    // This prevents "flushSync was called from inside a lifecycle method" warning
    queueMicrotask(() => {
      try {
        flushSync(() => {
          setToasts(prev => {
            const newToasts = [...prev];
            newToasts.push(serializedToast);
            return newToasts;
          });
          setToastKey(prev => prev + 1);
        });
      } catch (error) {
        // Fallback: If flushSync fails (e.g., during render), use regular state update
        setToasts(prev => {
          const newToasts = [...prev];
          newToasts.push(serializedToast);
          return newToasts;
        });
        setToastKey(prev => prev + 1);
      }
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);
  
  // ✅ FIX: Set toast handler for API client (so it can show toasts automatically)
  useEffect(() => {
    import('./services/api.js').then(({ setToastHandler }) => {
      setToastHandler(showNotification);
    });
  }, [showNotification]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (isGuest) {
      if (!isAutoSave) {
        setShowLoginPrompt(true);
      }
      return;
    }

    // ✅ FIX: Set saving status immediately for better UX feedback
    if (!isAutoSave) {
      setSaveStatus('saving');
    }

    try {
      console.log(`💾 ${isAutoSave ? 'Auto-' : ''}Saving project...`);
      
      // ✅ FIX: Serialize ALL current state first (instruments, patterns, mixer, arrangement, etc.)
      const { ProjectSerializer } = await import('./lib/project/ProjectSerializer.js');
      const serializedData = ProjectSerializer.serializeCurrentState();
      
      // ✅ FIX: Get or create project - if no project ID, create new project with current state
      let projectId = currentProjectId;
      if (!projectId) {
        console.log('💾 Creating new project on first save...');
        
        // Get project metadata from store or use defaults
        const playbackStore = usePlaybackStore.getState();
        const projectData = {
          title: currentProjectTitle || 'Untitled Project',
          bpm: playbackStore.bpm || 120,
          timeSignature: playbackStore.timeSignature || '4/4',
          keySignature: playbackStore.keySignature,
          ...serializedData,
        };
        
        const newProject = await projectService.createProject(projectData);
        
        projectId = newProject.id;
        setCurrentProjectId(projectId);
        setCurrentProjectTitle(newProject.title || 'Untitled Project');
        
        // ✅ Update URL to reflect new project
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('project', projectId);
        window.history.replaceState({}, '', currentUrl.toString());
        
        console.log('✅ New project created on first save:', projectId);
        
        // Project is already created with data, so we're done
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        hasUnsavedChangesRef.current = false;
        
        if (!isAutoSave) {
          showNotification('Project saved successfully', 'success');
        }
        return; // Exit early - project already created and saved
      }
      
      // Get project metadata from store or use defaults
      const playbackStore = usePlaybackStore.getState();
      const projectData = {
        title: currentProjectTitle,
        bpm: playbackStore.bpm || 120,
        timeSignature: playbackStore.timeSignature || '4/4',
        keySignature: playbackStore.keySignature,
        // ✅ FIX: Pass serialized data - ProjectSerializer.serialize() will handle it
        ...serializedData,
      };
      
      await projectService.saveProject(projectId, projectData);
      console.log(`✅ Project ${isAutoSave ? 'auto-' : ''}saved successfully`);
      
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      hasUnsavedChangesRef.current = false;
      
      // ✅ Show success notification (only for manual saves)
      if (!isAutoSave) {
        showNotification('Project saved successfully', 'success');
      }
    } catch (error) {
      console.error(`❌ Failed to ${isAutoSave ? 'auto-' : ''}save project:`, error);
      setSaveStatus('error');
      
      // ✅ Show error notification (only for manual saves)
      if (!isAutoSave) {
        showNotification(`Failed to save project: ${error.message}`, 'error');
      }
    }
  }, [isGuest, currentProjectId, currentProjectTitle, showNotification]);

  // ✅ 1. AUTO-SAVE: Debounced auto-save every 30 seconds if there are unsaved changes
  useEffect(() => {
    if (engineStatus === 'ready' && isAuthenticated && !isGuest && currentProjectId && templateInitialized) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      
      // Set up auto-save timer (30 seconds)
      autoSaveTimerRef.current = setInterval(() => {
        if (hasUnsavedChangesRef.current && saveStatus !== 'saving') {
          console.log('⏰ Auto-save triggered...');
          handleSave(true); // Auto-save
        }
      }, 30000); // 30 seconds
      
      return () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current);
        }
      };
    }
  }, [engineStatus, isAuthenticated, isGuest, currentProjectId, templateInitialized, handleSave, saveStatus]);

  // ✅ 2. UNSAVED CHANGES WARNING: Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChangesRef.current && !isGuest) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGuest]);

  // ✅ 3. KEYBOARD SHORTCUTS: Ctrl/Cmd+S for save, Ctrl/Cmd+E for export
  useEffect(() => {
    if (engineStatus === 'ready') {
      const handleKeyDown = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
          e.preventDefault();
          setIsExportPanelOpen(prev => !prev);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          handleSave(false); // Manual save
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [engineStatus, handleSave]);

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
          <ThemeProvider>
            {/* ✅ FIX: Show project loading screen overlay */}
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
            {/* ✅ FIX: Modal'ları ve ToastContainer'ı app-container dışına taşıdık - overlay'in tam ekranı kaplaması ve pointer-events sorunlarını önlemek için */}
            <ProjectTitleModal
              isOpen={showProjectTitleModal}
              onClose={() => setShowProjectTitleModal(false)}
              currentTitle={currentProjectTitle}
              onSave={async (newTitle) => {
                setCurrentProjectTitle(newTitle);
                hasUnsavedChangesRef.current = true;
                setSaveStatus('unsaved');
                // Auto-save after title change
                if (currentProjectId) {
                  await handleSave(false);
                }
              }}
            />
            {/* ✅ FIX: ToastContainer'ı app-container dışına taşıdık - pointer-events sorunlarını önlemek için */}
            <ToastContainer key={toastKey} toasts={toasts} onRemove={removeToast} />
            {/* ✅ FIX: Modal'ları app-container dışına taşıdık - pointer-events sorunlarını önlemek için */}
            <ExportPanel isOpen={isExportPanelOpen} onClose={() => setIsExportPanelOpen(false)} />
            {/* ✅ FIX: Channel Rack modals moved to App level to avoid overflow issues */}
            <AudioExportPanel 
              isOpen={isAudioExportPanelOpen} 
              onClose={() => setAudioExportPanelOpen(false)} 
            />
            <InstrumentPickerWrapper />
            <LoginPrompt 
              isOpen={showLoginPrompt} 
              onClose={() => setShowLoginPrompt(false)}
              onLogin={() => {
                // User is now authenticated, state updated automatically
                setShowLoginPrompt(false);
              }}
            />
            <div 
              className="app-container" 
              style={{ 
                marginTop: '56px', // Navigation header (56px)
                height: 'calc(100vh - 56px)', // Full viewport minus header
                opacity: isLoadingProject ? 0.3 : 1, // ✅ FIX: Dim UI during loading
                pointerEvents: isLoadingProject ? 'none' : 'auto', // ✅ FIX: Disable interactions during loading
                transition: 'opacity 0.3s ease-out' // ✅ FIX: Smooth transition
              }}
            >
              <TopToolbar 
                onExportClick={() => {
                  console.log('🎵 Export button clicked in App.jsx');
                  setIsExportPanelOpen(true);
                }} 
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
          </ThemeProvider>
        );
      case 'idle':
      default:
        // ✅ UX IMPROVEMENT: Check if engine is being restored
        // If engine exists but status is still 'idle', show loading instead of startup screen
        const existingEngine = AudioContextService.getAudioEngine();
        if (existingEngine && existingEngine.audioContext && existingEngine.audioContext.state !== 'closed') {
          // Engine exists but status hasn't updated yet - show loading
          return (
            <ThemeProvider>
              <LoadingScreen message="Stüdyoya bağlanılıyor..." />
            </ThemeProvider>
          );
        }
        if (autoStartInProgress) {
          return (
            <ThemeProvider>
              <LoadingScreen message="Stüdyoya bağlanılıyor..." />
            </ThemeProvider>
          );
        }
        // No engine exists - show startup screen
        return <StartupScreen onStart={initializeAudioSystem} />;
    }
  }, [engineStatus, engineError, initializeAudioSystem, isExportPanelOpen, isAudioExportPanelOpen, setAudioExportPanelOpen, showLoginPrompt, showProjectTitleModal, handleSave, isAuthenticated, isGuest, currentProjectId, handleProjectSelect, handleNewProject, handleEditTitle, isLoadingProject, loadingProjectTitle, currentProjectTitle, toasts, toastKey, removeToast, saveStatus, lastSavedAt, autoStartInProgress]);

  return <>{renderContent()}</>;
}

// Media Component - Full page route for Media Panel
function MediaApp() {
  return (
    <ThemeProvider>
      <NavigationHeader />
      <div 
        className="media-app" 
        style={{ 
          marginTop: '56px', // Navigation header
          height: 'calc(100vh - 56px)', // Full viewport minus header
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
        <MediaPanel />
        </Suspense>
      </div>
    </ThemeProvider>
  );
}

// Protected Route Component
function ProtectedRoute({ children, requireAuth = false }) {
  const { isAuthenticated, isGuest } = useAuthStore();
  const location = useLocation();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}

// Main App Router
function AppRouter() {
  const { isAuthenticated, isGuest } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check authentication on mount
    authService.checkAuth().then((authenticated) => {
      setAuthChecked(true);
      // If authenticated, check if user has already chosen
      if (authenticated) {
        try {
          const hasChosen = sessionStorage.getItem('user-has-chosen');
          if (!hasChosen || !JSON.parse(hasChosen)) {
            setShowWelcome(true);
          }
        } catch {
          setShowWelcome(true);
        }
      }
    }).catch(() => {
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return <LoadingScreen />;
  }

  // Show welcome screen if authenticated and hasn't chosen yet
  if (showWelcome && isAuthenticated) {
    return (
      <ThemeProvider>
        <WelcomeScreen onChoose={() => setShowWelcome(false)} />
      </ThemeProvider>
    );
  }

  return (
    <Routes>
      {/* Auth Route - Show if not authenticated and not guest */}
      <Route 
        path="/auth" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <AuthScreen 
              onSuccess={() => {
                // After successful login, show welcome screen
                const hasChosen = sessionStorage.getItem('user-has-chosen');
                if (!hasChosen) {
                  setShowWelcome(true);
                } else {
                  window.location.href = '/';
                }
              }}
              onGuest={() => {
                authService.continueAsGuest();
                window.location.href = '/daw';
              }}
            />
          )
        } 
      />

      {/* Welcome Route */}
      <Route 
        path="/welcome" 
        element={
          isAuthenticated ? (
            <ThemeProvider>
              <WelcomeScreen onChoose={() => setShowWelcome(false)} />
            </ThemeProvider>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />

      {/* Home - Redirect based on auth status */}
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            // Authenticated: check if has chosen, if not show welcome
            (() => {
              const hasChosen = sessionStorage.getItem('user-has-chosen');
              if (!hasChosen) {
                return <Navigate to="/welcome" replace />;
              }
              return <Navigate to="/daw" replace />;
            })()
          ) : isGuest ? (
            // Guest: go to DAW
            <Navigate to="/daw" replace />
          ) : (
            // Not authenticated and not guest: go to auth
            <Navigate to="/auth" replace />
          )
        } 
      />

      {/* DAW Route */}
      <Route 
        path="/daw" 
        element={
          <ProtectedRoute>
            <DAWApp />
          </ProtectedRoute>
        } 
      />

      {/* Media Route */}
      <Route 
        path="/media" 
        element={
          <ProtectedRoute>
            <MediaApp />
          </ProtectedRoute>
        } 
      />

      {/* Admin Panel Route */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute requireAuth={true}>
            <ThemeProvider>
              <Suspense fallback={<LoadingScreen />}>
              <AdminPanel />
              </Suspense>
            </ThemeProvider>
          </ProtectedRoute>
        } 
      />

      {/* Projects Management Route */}
      <Route 
        path="/projects" 
        element={
          <ProtectedRoute requireAuth={true}>
            <ThemeProvider>
              <Suspense fallback={<LoadingScreen />}>
              <ProjectsPage />
              </Suspense>
            </ThemeProvider>
          </ProtectedRoute>
        } 
      />

      {/* Render Route (for headless browser/Puppeteer) */}
      <Route 
        path="/render" 
        element={
          <ThemeProvider>
            <Suspense fallback={<LoadingScreen />}>
            <RenderPage />
            </Suspense>
          </ThemeProvider>
        } 
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Root App Component
function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;