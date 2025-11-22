#!/usr/bin/env node

/**
 * Generate audio manifest for dynamic file browser loading
 * Scans public/audio/samples directories and creates a manifest.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicAudioDir = path.join(rootDir, 'public', 'audio', 'samples');

/**
 * Recursively scan directory and return all audio files
 */
function scanDirectory(dir, relativePath = '') {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativeFilePath = path.join(relativePath, entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      files.push(...scanDirectory(fullPath, relativeFilePath));
    } else if (entry.isFile()) {
      // Check if it's an audio file
      const ext = path.extname(entry.name).toLowerCase();
      const audioExtensions = ['.wav', '.ogg', '.mp3', '.flac', '.aiff', '.aif'];
      
      if (audioExtensions.includes(ext)) {
        files.push({
          name: entry.name,
          path: relativeFilePath,
          url: `/audio/samples/${relativeFilePath}`,
          size: fs.statSync(fullPath).size,
          ext: ext.substring(1) // Remove dot
        });
      }
    }
  }

  return files;
}

/**
 * Organize files by directory structure
 */
function organizeFiles(files) {
  const structure = {};

  for (const file of files) {
    const dirParts = file.path.split('/').slice(0, -1); // Remove filename
    const dirPath = dirParts.join('/');
    const dirName = dirParts[dirParts.length - 1] || 'root';

    if (!structure[dirPath]) {
      structure[dirPath] = {
        name: dirName,
        path: dirPath,
        files: []
      };
    }

    structure[dirPath].files.push(file);
  }

  return structure;
}

/**
 * Main function
 */
function generateManifest() {
  console.log('📦 Scanning audio samples directory...');
  console.log(`   Path: ${publicAudioDir}`);

  if (!fs.existsSync(publicAudioDir)) {
    console.warn(`⚠️  Directory not found: ${publicAudioDir}`);
    return;
  }

  // Scan all audio files
  const allFiles = scanDirectory(publicAudioDir);
  console.log(`✅ Found ${allFiles.length} audio files`);

  // Organize by directory
  const structure = organizeFiles(allFiles);

  // Create manifest
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalFiles: allFiles.length,
    directories: Object.values(structure).map(dir => ({
      name: dir.name,
      path: dir.path,
      fileCount: dir.files.length,
      files: dir.files.map(f => ({
        name: f.name,
        url: f.url,
        size: f.size,
        ext: f.ext
      }))
    }))
  };

  // Write manifest to public directory
  const manifestPath = path.join(rootDir, 'public', 'audio-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Manifest generated: ${manifestPath}`);
  console.log(`   Directories: ${manifest.directories.length}`);
  console.log(`   Total files: ${manifest.totalFiles}`);

  // Log structure
  for (const dir of manifest.directories) {
    console.log(`   📁 ${dir.path || 'root'}: ${dir.fileCount} files`);
  }
}

// Run
try {
  generateManifest();
} catch (error) {
  console.error('❌ Error generating manifest:', error);
  process.exit(1);
}

