/**
 * Project Service
 * Handles project CRUD operations and serialization
 */

import { apiClient } from './api.js';
import { ProjectSerializer } from '../lib/project/ProjectSerializer.js';

export const projectService = {
  /**
   * Create a new project
   */
  async createProject(projectData) {
    try {
      const serialized = ProjectSerializer.serialize(projectData);
      
      const response = await apiClient.createProject({
        title: projectData.title || 'Untitled Project',
        description: projectData.description,
        bpm: projectData.bpm || 120,
        keySignature: projectData.keySignature,
        timeSignature: projectData.timeSignature || '4/4',
        projectData: serialized,
        isPublic: projectData.isPublic || false,
        isUnlisted: projectData.isUnlisted || false,
      });

      // ✅ FIX: Backend returns { project: { id, ... } }, extract project object
      const project = response.project || response;
      console.log('✅ Project created:', project.id);
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  },

  /**
   * Load project by ID
   */
  async loadProject(projectId) {
    try {
      const response = await apiClient.getProject(projectId);
      
      // Backend returns { project: { projectData, ... } }
      const project = response.project || response;
      let projectData = project.projectData;
      
      // If projectData is a string, parse it
      if (typeof projectData === 'string') {
        try {
          projectData = JSON.parse(projectData);
        } catch (parseError) {
          console.error('Failed to parse projectData:', parseError);
          throw new Error('Invalid project data format');
        }
      }
      
      // ✅ FIX: Clear existing state BEFORE loading new project (to avoid stacking)
      await ProjectSerializer.clearAll();
      
      // If projectData is null or undefined, create empty project template
      if (!projectData || typeof projectData !== 'object' || Object.keys(projectData).length === 0) {
        console.log('📋 Project data is empty, creating empty project template...');
        projectData = ProjectSerializer.createEmptyProjectTemplate();
        console.log('✅ Empty project template created with 4 instruments, 20 mixer channels, and 20 arrangement tracks');
      }
      
      // Deserialize project data
      await ProjectSerializer.deserialize(projectData);
      
      return {
        ...project,
        projectData,
      };
    } catch (error) {
      console.error('Failed to load project:', error);
      throw error;
    }
  },

  /**
   * Save/Update project
   */
  async saveProject(projectId, projectData) {
    try {
      const serialized = ProjectSerializer.serialize(projectData);
      
      const response = await apiClient.updateProject(projectId, {
        title: projectData.title,
        description: projectData.description,
        bpm: projectData.bpm,
        keySignature: projectData.keySignature,
        timeSignature: projectData.timeSignature,
        projectData: serialized,
      });

      return response;
    } catch (error) {
      console.error('Failed to save project:', error);
      throw error;
    }
  },

  /**
   * List user's projects
   */
  async listProjects(params = {}) {
    try {
      return await apiClient.getProjects(params);
    } catch (error) {
      console.error('Failed to list projects:', error);
      throw error;
    }
  },

  /**
   * Delete project
   */
  async deleteProject(projectId) {
    try {
      return await apiClient.deleteProject(projectId);
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  },

  /**
   * Create a test project for the current user
   */
  async createTestProject() {
    try {
      // Get current state from all stores
      const projectData = ProjectSerializer.serializeCurrentState();
      
      const response = await this.createProject({
        title: 'Test Project',
        description: 'Test project for development',
        ...projectData,
      });

      console.log('✅ Test project created:', response.id);
      return response;
    } catch (error) {
      console.error('Failed to create test project:', error);
      throw error;
    }
  },

  /**
   * Load user's first project or create a new one
   * ✅ FIX: Load first existing project instead of always creating test project
   */
  async loadOrCreateFirstProject() {
    try {
      // List user's projects (sorted by updated_at desc)
      const projectsResponse = await this.listProjects({
        sortBy: 'updated_at',
        sortOrder: 'desc',
        limit: 1,
      });
      
      if (projectsResponse.projects && projectsResponse.projects.length > 0) {
        // Load first (most recent) project
        const firstProject = projectsResponse.projects[0];
        console.log('📂 Found existing project, loading:', firstProject.id);
        return await this.loadProject(firstProject.id);
      }

      // No projects exist, create new empty project
      console.log('📝 No projects found, creating new project...');
      const { ProjectSerializer } = await import('../lib/project/ProjectSerializer.js');
      const emptyTemplate = ProjectSerializer.createEmptyProjectTemplate();
      
      const newProject = await this.createProject({
        title: 'Untitled Project',
        ...emptyTemplate,
      });
      
      console.log('✅ New project created:', newProject.id);
      return await this.loadProject(newProject.id);
    } catch (error) {
      console.error('Failed to load or create first project:', error);
      throw error;
    }
  },
};

