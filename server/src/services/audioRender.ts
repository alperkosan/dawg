/**
 * Audio Render Service
 * Headless browser-based audio rendering for project previews
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config/index.js';
import { storageService } from './storage.js';
import { findProjectById, updateProject } from './projects.js';
import { logger } from '../utils/logger.js';
import { getDatabase } from './database.js';

export interface RenderOptions {
  format?: 'wav' | 'mp3';
  bitrate?: number;
  duration?: number; // seconds, null = full track
  quality?: 'draft' | 'standard' | 'high';
}

export class AudioRenderService {
  private browser: Browser | null = null;
  private isInitialized = false;

  /**
   * Initialize Puppeteer browser
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.browser) {
      return;
    }

    try {
      logger.info('🎬 Initializing Puppeteer browser for audio rendering...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      this.isInitialized = true;
      logger.info('✅ Puppeteer browser initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  /**
   * Render project preview audio
   */
  async renderProjectPreview(
    projectId: string,
    options: RenderOptions = {}
  ): Promise<{ previewAudioUrl: string; duration: number }> {
    logger.info(`🎬 [RENDER] Starting render for project: ${projectId}`);
    
    if (!this.browser || !this.isInitialized) {
      logger.info(`🎬 [RENDER] Initializing Puppeteer browser...`);
      await this.initialize();
    }

    const project = await findProjectById(projectId);
    if (!project) {
      logger.error(`❌ [RENDER] Project not found: ${projectId}`);
      throw new Error('Project not found');
    }

    logger.info(`🎬 [RENDER] Project found: ${project.title} (user: ${project.user_id})`);

    // Update status to 'rendering'
    logger.info(`🎬 [RENDER] Updating project status to 'rendering'...`);
    await this.updateRenderStatus(projectId, 'rendering');

    const page = await this.browser!.newPage();
    
    // ✅ Capture browser console logs and errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        logger.error(`🌐 [BROWSER] Console error: ${text}`);
      } else if (type === 'warning') {
        logger.warn(`🌐 [BROWSER] Console warning: ${text}`);
      } else {
        logger.info(`🌐 [BROWSER] Console ${type}: ${text}`);
      }
    });
    
    page.on('pageerror', (error) => {
      logger.error(`🌐 [BROWSER] Page error:`, error);
      logger.error(`🌐 [BROWSER] Error message: ${error.message}`);
      logger.error(`🌐 [BROWSER] Error stack: ${error.stack}`);
    });
    
    try {
      // Set timeout for render (5 minutes max)
      page.setDefaultTimeout(300000); // 5 minutes

      // Navigate to render page
      const renderUrl = `${config.clientUrl || 'http://localhost:5173'}/render?projectId=${projectId}`;
      logger.info(`🎬 [RENDER] Navigating to render page: ${renderUrl}`);
      
      const navigationStart = Date.now();
      await page.goto(renderUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000, // 1 minute for page load
      });
      const navigationTime = Date.now() - navigationStart;
      logger.info(`✅ [RENDER] Page loaded in ${navigationTime}ms`);

      // Wait for React to mount and useEffect to run
      logger.info('⏳ [RENDER] Waiting for React to initialize and useEffect to run...');
      try {
        // Wait for RenderPage to set up window properties (useEffect runs)
        await page.waitForFunction(
          () => {
            // Check if useEffect has started (window.renderResult or window.renderError should be initialized)
            // Or if renderProject has started (we'll check for console logs)
            return typeof (window as any).renderResult !== 'undefined' || 
                   typeof (window as any).renderError !== 'undefined' ||
                   (window as any).renderPageMounted === true;
          },
          { timeout: 10000 } // 10 seconds max
        );
        logger.info('✅ [RENDER] React useEffect detected');
      } catch (e) {
        logger.warn('⚠️ [RENDER] Could not detect React mount, continuing anyway...');
      }

      // Wait for render to complete
      logger.info('⏳ [RENDER] Waiting for audio render to complete...');
      const renderStart = Date.now();
      
      const renderResult = await page.evaluate(async () => {
        console.log(`🎬 [RENDER] page.evaluate started, checking window state...`);
        console.log(`📊 [RENDER] Initial state:`, {
          hasResult: !!(window as any).renderResult,
          hasError: !!(window as any).renderError,
          renderPageMounted: !!(window as any).renderPageMounted,
        });
        
        // First, check if render has already started or completed
        if ((window as any).renderResult) {
          console.log(`✅ [RENDER] Render result already available!`);
          return (window as any).renderResult;
        }
        
        if ((window as any).renderError) {
          const errorMsg = (window as any).renderError;
          console.error(`❌ [RENDER] Render error already detected: ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        // Wait for window.renderResult to be set
        return new Promise((resolve, reject) => {
          console.log(`⏳ [RENDER] Starting promise to wait for render result...`);
          const maxWait = 300000; // 5 minutes
          const startTime = Date.now();
          let lastCheckTime = startTime;
          let lastState = {
            hasResult: !!(window as any).renderResult,
            hasError: !!(window as any).renderError,
          };
          
          const checkResult = () => {
            const elapsed = Date.now() - startTime;
            const sinceLastCheck = Date.now() - lastCheckTime;
            
            // Check current state
            const currentState = {
              hasResult: !!(window as any).renderResult,
              hasError: !!(window as any).renderError,
            };
            
            // Log state changes
            if (currentState.hasResult !== lastState.hasResult || currentState.hasError !== lastState.hasError) {
              console.log(`📊 [RENDER] State changed:`, currentState);
              lastState = currentState;
            }
            
            // Log progress every 10 seconds
            if (sinceLastCheck >= 10000) {
              console.log(`⏳ [RENDER] Still waiting... (${Math.floor(elapsed / 1000)}s elapsed)`);
              console.log(`📊 [RENDER] Current state:`, {
                hasResult: currentState.hasResult,
                hasError: currentState.hasError,
                renderError: (window as any).renderError || null,
              });
              lastCheckTime = Date.now();
            }
            
            if ((window as any).renderResult) {
              console.log(`✅ [RENDER] Render result found!`);
              resolve((window as any).renderResult);
            } else if ((window as any).renderError) {
              const errorMsg = (window as any).renderError;
              console.error(`❌ [RENDER] Render error detected: ${errorMsg}`);
              reject(new Error(errorMsg));
            } else if (elapsed > maxWait) {
              console.error(`❌ [RENDER] Render timeout after ${Math.floor(maxWait / 1000)}s`);
              console.error(`❌ [RENDER] Final state:`, {
                hasResult: currentState.hasResult,
                hasError: currentState.hasError,
                renderError: (window as any).renderError || null,
              });
              reject(new Error(`Render timeout after ${Math.floor(maxWait / 1000)}s`));
            } else {
              setTimeout(checkResult, 500); // Check every 500ms instead of 1000ms
            }
          };
          
          checkResult();
        });
      });

      const renderTime = Date.now() - renderStart;
      logger.info(`✅ [RENDER] Audio render completed in ${renderTime}ms, processing result...`);

      // renderResult should be { audioBuffer: base64, duration: number }
      const { audioBuffer: audioBufferBase64, duration } = renderResult as {
        audioBuffer: string;
        duration: number;
      };

      logger.info(`📊 [RENDER] Render result: duration=${duration}s, bufferSize=${audioBufferBase64.length} bytes (base64)`);

      // Decode base64 to buffer
      const audioBuffer = Buffer.from(audioBufferBase64, 'base64');
      logger.info(`📊 [RENDER] Decoded audio buffer: ${audioBuffer.length} bytes`);

      // Encode to MP3 (for now, we'll use WAV and convert later if needed)
      // TODO: Add MP3 encoding (FFmpeg or lame)
      const filename = `${projectId}-preview.wav`;
      const storageKey = `project-previews/${projectId}/${filename}`;

      // Upload to CDN
      logger.info(`📤 [RENDER] Uploading rendered audio to CDN... (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      const uploadStart = Date.now();
      const storageResult = await storageService.uploadFile(
        project.user_id,
        filename,
        audioBuffer,
        false, // not system asset
        undefined,
        undefined,
        storageKey
      );
      const uploadTime = Date.now() - uploadStart;
      logger.info(`✅ [RENDER] Audio uploaded to CDN in ${uploadTime}ms: ${storageResult.storageUrl}`);

      // Update project
      logger.info(`💾 [RENDER] Updating project record with preview audio URL...`);
      await updateProject(projectId, {
        previewAudioUrl: storageResult.storageUrl,
        previewAudioDuration: Math.round(duration),
        previewAudioRenderedAt: new Date(),
        previewAudioStatus: 'ready',
      });

      const totalTime = Date.now() - navigationStart;
      logger.info(`✅ [RENDER] Render complete! Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
      logger.info(`✅ [RENDER] Preview audio URL: ${storageResult.storageUrl}`);

      return {
        previewAudioUrl: storageResult.storageUrl,
        duration: Math.round(duration),
      };
    } catch (error) {
      // Try to get browser console logs and error state for more context
      try {
        const browserState = await page.evaluate(() => {
          return {
            renderError: (window as any).renderError || null,
            renderResult: (window as any).renderResult ? 'exists' : null,
            hasError: !!(window as any).renderError,
            hasResult: !!(window as any).renderResult,
            renderPageMounted: !!(window as any).renderPageMounted,
            windowLocation: window.location.href,
          };
        });
        
        logger.error(`❌ [RENDER] Browser state at error:`, JSON.stringify(browserState, null, 2));
        
        if (browserState.renderError) {
          logger.error(`❌ [RENDER] Browser reported error: ${browserState.renderError}`);
        }
        
        if (!browserState.renderPageMounted) {
          logger.error(`❌ [RENDER] RenderPage useEffect never ran! window.renderPageMounted is false`);
        }
      } catch (e) {
        logger.warn(`⚠️ [RENDER] Could not get browser state:`, e instanceof Error ? e.message : String(e));
      }
      
      // Log the actual error object
      logger.error(`❌ [RENDER] Audio render failed for project ${projectId}`);
      if (error instanceof Error) {
        logger.error(`❌ [RENDER] Error message: ${error.message}`);
        logger.error(`❌ [RENDER] Error stack: ${error.stack}`);
        logger.error(`❌ [RENDER] Error name: ${error.name}`);
      } else {
        logger.error(`❌ [RENDER] Error (not Error instance):`, error);
        logger.error(`❌ [RENDER] Error string: ${String(error)}`);
      }
      
      logger.error(`❌ [RENDER] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId,
        errorType: error?.constructor?.name || typeof error,
        errorString: String(error),
      });
      
      // Update status to 'failed'
      logger.info(`💾 [RENDER] Updating project status to 'failed'...`);
      await this.updateRenderStatus(projectId, 'failed');
      
      throw error;
    } finally {
      logger.info(`🧹 [RENDER] Closing Puppeteer page...`);
      await page.close();
    }
  }

  /**
   * Update render status in database
   */
  private async updateRenderStatus(
    projectId: string,
    status: 'pending' | 'rendering' | 'ready' | 'failed'
  ): Promise<void> {
    const db = getDatabase();
    await db.query(
      `UPDATE projects 
       SET preview_audio_status = $1,
           ${status === 'ready' ? 'preview_audio_rendered_at = NOW(),' : ''}
           updated_at = NOW()
       WHERE id = $2`,
      [status, projectId]
    );
  }

  /**
   * Cleanup browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      logger.info('🧹 Puppeteer browser closed');
    }
  }
}

// Singleton instance
let renderServiceInstance: AudioRenderService | null = null;

export function getAudioRenderService(): AudioRenderService {
  if (!renderServiceInstance) {
    renderServiceInstance = new AudioRenderService();
  }
  return renderServiceInstance;
}

