import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { useToast } from '../providers/ToastProvider';
import { projectService } from '../services/projectService';

export function useProjectManager(engineStatus, initializeAudioSystem) {
    const [searchParams, setSearchParams] = useSearchParams();
    const { showToast } = useToast();
    const { isGuest, isAuthenticated, user } = useAuthStore();

    // UI State managed by Project Manager
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [showProjectTitleModal, setShowProjectTitleModal] = useState(false);

    // Project State
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [currentProjectTitle, setCurrentProjectTitle] = useState('Untitled Project');
    const [templateInitialized, setTemplateInitialized] = useState(false);
    const [isLoadingProject, setIsLoadingProject] = useState(false);
    const [loadingProjectTitle, setLoadingProjectTitle] = useState(null);
    const [projectLoadAttempted, setProjectLoadAttempted] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [lastSavedAt, setLastSavedAt] = useState(null);

    const autoSaveTimerRef = useRef(null);
    const hasUnsavedChangesRef = useRef(false);
    const authSessionRef = useRef(null);

    // ---------------------------------------------------------------------------
    // 1. Workspace Actions
    // ---------------------------------------------------------------------------

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

        import('../lib/project/ProjectSerializer.js')
            .then(({ ProjectSerializer }) => ProjectSerializer.clearAll())
            .catch((error) => console.warn('⚠️ Failed to clear workspace state:', error));
    }, []);

    const prepareEmptyWorkspace = useCallback(
        async ({ loadingTitle = 'Yeni proje hazırlanıyor...', markUnsaved = true } = {}) => {
            try {
                setIsLoadingProject(true);
                setLoadingProjectTitle(loadingTitle);
                const { ProjectSerializer } = await import('../lib/project/ProjectSerializer.js');
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

                // Update URL silently
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

    const handleProjectSelect = useCallback(async (projectId) => {
        try {
            console.log('📂 Loading project:', projectId);
            setIsLoadingProject(true);
            setLoadingProjectTitle(null);

            setProjectLoadAttempted(prev => {
                if (!prev) return true;
                return prev;
            });

            setTemplateInitialized(false);
            const project = await projectService.loadProject(projectId);
            const projectTitle = project.title || 'Untitled Project';
            setLoadingProjectTitle(projectTitle);
            setCurrentProjectTitle(projectTitle);
            setCurrentProjectId(project.id);
            setTemplateInitialized(true);
            setSaveStatus('saved');
            setLastSavedAt(project.updatedAt ? new Date(project.updatedAt) : new Date());
            hasUnsavedChangesRef.current = false;

            const currentUrl = new URL(window.location.href);
            const currentProjectIdFromUrl = currentUrl.searchParams.get('project');
            if (currentProjectIdFromUrl !== projectId) {
                currentUrl.searchParams.set('project', projectId);
                window.history.replaceState({}, '', currentUrl.toString());
            }

            console.log('✅ Project loaded:', project.id);
        } catch (error) {
            console.error('❌ Failed to load project:', error);
            setProjectLoadAttempted(false);
            throw error;
        } finally {
            setIsLoadingProject(false);
            setLoadingProjectTitle(null);
        }
    }, []);

    const handleEditTitle = useCallback(() => {
        setShowProjectTitleModal(true);
    }, []);

    const handleTitleSave = useCallback(async (newTitle) => {
        setCurrentProjectTitle(newTitle);
        hasUnsavedChangesRef.current = true;
        setSaveStatus('unsaved');
        if (currentProjectId) await handleSave(false);
    }, [currentProjectId]); // Will define handleSave shortly, hoisting handles reference

    const handleNewProject = useCallback(async () => {
        try {
            console.log('📝 Creating new project...');
            setIsLoadingProject(true);
            setLoadingProjectTitle('Yeni Proje Oluşturuluyor...');
            setTemplateInitialized(false);

            const { ProjectSerializer } = await import('../lib/project/ProjectSerializer.js');
            await ProjectSerializer.clearAll();
            const template = ProjectSerializer.createEmptyProjectTemplate();

            const newProject = await projectService.createProject({
                title: 'Untitled Project',
                ...template,
            });

            if (!newProject || !newProject.id) {
                throw new Error('Failed to create project: No project ID returned');
            }

            console.log('✅ New project created:', newProject.id);
            setLoadingProjectTitle('Untitled Project');
            setCurrentProjectTitle('Untitled Project');
            await handleProjectSelect(newProject.id);

            setSaveStatus('saved');
            setLastSavedAt(new Date());
            hasUnsavedChangesRef.current = false;
        } catch (error) {
            console.error('❌ Failed to create new project:', error);
            setIsLoadingProject(false);
            setLoadingProjectTitle(null);
        }
    }, [handleProjectSelect]);

    const handleSave = useCallback(async (isAutoSave = false) => {
        if (isGuest) {
            if (!isAutoSave) setShowLoginPrompt(true);
            return;
        }

        if (!isAutoSave) setSaveStatus('saving');

        try {
            console.log(`💾 ${isAutoSave ? 'Auto-' : ''}Saving project...`);
            const { ProjectSerializer } = await import('../lib/project/ProjectSerializer.js');
            const serializedData = ProjectSerializer.serializeCurrentState();

            let projectId = currentProjectId;
            const playbackStore = usePlaybackStore.getState();

            if (!projectId) {
                console.log('💾 Creating new project on first save...');
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

                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('project', projectId);
                window.history.replaceState({}, '', currentUrl.toString());

                setSaveStatus('saved');
                setLastSavedAt(new Date());
                hasUnsavedChangesRef.current = false;

                if (!isAutoSave) showToast('Project saved successfully', 'success');
                return;
            }

            const projectData = {
                title: currentProjectTitle,
                bpm: playbackStore.bpm || 120,
                timeSignature: playbackStore.timeSignature || '4/4',
                keySignature: playbackStore.keySignature,
                ...serializedData,
            };

            await projectService.saveProject(projectId, projectData);
            setSaveStatus('saved');
            setLastSavedAt(new Date());
            hasUnsavedChangesRef.current = false;

            if (!isAutoSave) showToast('Project saved successfully', 'success');
        } catch (error) {
            console.error(`❌ Failed to ${isAutoSave ? 'auto-' : ''}save project:`, error);
            setSaveStatus('error');
            if (!isAutoSave) showToast(`Failed to save project: ${error.message}`, 'error');
        }
    }, [isGuest, currentProjectId, currentProjectTitle, showToast]);

    // ---------------------------------------------------------------------------
    // 2. Effects & Listeners
    // ---------------------------------------------------------------------------

    // Handle Default/URL Project Loading
    useEffect(() => {
        if (engineStatus === 'ready' && !templateInitialized && !projectLoadAttempted && !isLoadingProject) {

            // ✅ CASE 1: Guest User - Always load empty workspace
            if (isGuest) {
                console.log('👤 Guest user detected - initializing empty workspace');
                setProjectLoadAttempted(true);
                prepareEmptyWorkspace({ loadingTitle: 'Yeni proje hazırlanıyor...', markUnsaved: false });
                return;
            }

            // ✅ CASE 2: Authenticated User - Load project from URL or Default
            if (isAuthenticated) {
                const loadProjectFromUrlOrDefault = async () => {
                    try {
                        setProjectLoadAttempted(true);
                        const projectIdFromUrl = searchParams.get('project');

                        if (projectIdFromUrl && projectIdFromUrl !== currentProjectId) {
                            console.log('📂 Loading project from URL:', projectIdFromUrl);
                            await handleProjectSelect(projectIdFromUrl);
                            return;
                        }

                        await loadDefaultWorkspace();
                    } catch (error) {
                        console.error('❌ Failed to load project:', error);
                        await prepareEmptyWorkspace({ loadingTitle: 'Yeni proje hazırlanıyor...', markUnsaved: true });
                        setProjectLoadAttempted(false);
                    }
                };
                loadProjectFromUrlOrDefault();
            }
        }
    }, [engineStatus, isAuthenticated, isGuest, templateInitialized, projectLoadAttempted, isLoadingProject, currentProjectId, searchParams, handleProjectSelect, loadDefaultWorkspace, prepareEmptyWorkspace]);

    // Auth/Session Management
    useEffect(() => {
        const authKey = isGuest ? 'guest' : (user?.id ? `user:${user.id}` : 'user');
        const prevAuthKey = authSessionRef.current;

        if (prevAuthKey === null) {
            authSessionRef.current = authKey;
            return;
        }
        if (prevAuthKey === authKey) return;

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
    }, [isGuest, isAuthenticated, user, resetWorkspaceState, currentProjectId]);

    // Auto-Save
    useEffect(() => {
        if (engineStatus === 'ready' && isAuthenticated && !isGuest && currentProjectId && templateInitialized) {
            if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setInterval(() => {
                if (hasUnsavedChangesRef.current && saveStatus !== 'saving') {
                    handleSave(true);
                }
            }, 30000);
            return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current); };
        }
    }, [engineStatus, isAuthenticated, isGuest, currentProjectId, templateInitialized, handleSave, saveStatus]);

    // Before Unload
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

    // Keyboard Shortcuts
    useEffect(() => {
        if (engineStatus === 'ready') {
            const handleKeyDown = (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                // Save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    handleSave(false);
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [engineStatus, handleSave]);

    return {
        // State
        currentProjectId,
        currentProjectTitle,
        isLoadingProject,
        loadingProjectTitle,
        saveStatus,
        lastSavedAt,
        showLoginPrompt,
        showProjectTitleModal,

        // Actions
        handleProjectSelect,
        handleNewProject,
        handleSave,
        handleEditTitle,
        handleTitleSave,

        // Setters (for UI that needs to toggle modals)
        setShowLoginPrompt,
        setShowProjectTitleModal
    };
}
