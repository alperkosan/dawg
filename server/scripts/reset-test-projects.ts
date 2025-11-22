/**
 * Reset test user projects
 * Deletes all projects for test@example.com and creates a new one
 */

import { getDatabase } from '../src/services/database.js';
import { createProject } from '../src/services/projects.js';

async function resetTestProjects() {
  const db = getDatabase();

  try {
    // 1. Find test user
    const userResult = await db.query(
      `SELECT id, email, username FROM users WHERE email = 'test@example.com' LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.error('❌ Test user not found. Please create test@example.com first.');
      process.exit(1);
    }

    const testUser = userResult.rows[0];
    console.log(`✅ Found test user: ${testUser.username} (${testUser.id})`);

    // 2. Delete all projects for test user (hard delete)
    const deleteResult = await db.query(
      `DELETE FROM projects WHERE user_id = $1`,
      [testUser.id]
    );

    console.log(`🗑️  Deleted ${deleteResult.rowCount} projects for test user`);

    // 3. Create empty project template
    // Note: We'll create a minimal project structure here
    const emptyTemplate = {
      metadata: {
        version: '1.0.0',
        dawg_version: '0.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bpm: 120,
        time_signature: '4/4',
        key_signature: null,
      },
      instruments: [
        {
          id: 'kick-1',
          name: 'Kick',
          type: 'sample',
          url: '/audio/samples/drums/kick.wav',
          mixerTrackId: 'track-1',
          color: '#ef4444',
        },
        {
          id: 'snare-1',
          name: 'Snare',
          type: 'sample',
          url: '/audio/samples/drums/snare.wav',
          mixerTrackId: 'track-2',
          color: '#3b82f6',
        },
        {
          id: 'hihat-1',
          name: 'Hi-Hat',
          type: 'sample',
          url: '/audio/samples/drums/hihat.wav',
          mixerTrackId: 'track-3',
          color: '#10b981',
        },
        {
          id: '808-1',
          name: '808',
          type: 'sample',
          url: '/audio/samples/drums/808.wav',
          mixerTrackId: 'track-4',
          color: '#f59e0b',
        },
      ],
      patterns: {
        'pattern-1': {
          id: 'pattern-1',
          name: 'Pattern 1',
          data: {},
          length: 64,
          settings: {
            quantization: '16n',
          },
        },
      },
      pattern_order: ['pattern-1'],
      active_pattern_id: 'pattern-1',
      arrangement: {
        tracks: Array.from({ length: 20 }, (_, i) => ({
          id: `arr-track-${i + 1}`,
          name: `Track ${i + 1}`,
          height: 80,
          volume: 1.0,
          pan: 0,
          muted: false,
          solo: false,
          locked: false,
          collapsed: false,
        })),
        clips: [],
        markers: [],
        loop_regions: [],
      },
      mixer: {
        tracks: Array.from({ length: 20 }, (_, i) => ({
          id: `track-${i + 1}`,
          name: `channel-${i + 1}`,
          type: 'track',
          volume: 0,
          pan: 0,
          muted: false,
          solo: false,
          color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i % 5],
          output: 'master',
          sends: [],
          insertEffects: [],
          eq: { enabled: false, lowGain: 0, midGain: 0, highGain: 0 },
        })),
        send_channels: [],
        master: {
          volume: 0,
          pan: 0,
          muted: false,
          solo: false,
          insertEffects: [],
          eq: { enabled: false, lowGain: 0, midGain: 0, highGain: 0 },
        },
      },
      timeline: {
        total_beats: 64,
        total_bars: 4,
        zoom: { x: 1, y: 1 },
        snap_mode: 'grid',
        grid_size: '1/4',
      },
      audio_assets: [],
      workspace: {
        viewMode: 'pattern',
        selectedTrackId: null,
        selectedClipIds: [],
      },
    };

    // 4. Create new project
    const newProject = await createProject({
      userId: testUser.id,
      title: 'Test Project',
      description: 'Test project created after reset',
      bpm: emptyTemplate.metadata.bpm || 120,
      timeSignature: emptyTemplate.metadata.time_signature || '4/4',
      projectData: emptyTemplate,
    });

    console.log(`✅ Created new test project: ${newProject.id}`);
    console.log(`   Title: ${newProject.title}`);
    console.log(`   BPM: ${newProject.bpm}`);
    console.log(`   Created at: ${newProject.created_at}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting test projects:', error);
    process.exit(1);
  }
}

resetTestProjects();

