/**
 * Check project patterns and notes in database
 */

import { getDatabase } from '../src/services/database.js';

async function checkProjectPatterns() {
  const db = getDatabase();

  try {
    // 1. Find test user
    const userResult = await db.query(
      `SELECT id, email, username FROM users WHERE email = 'test@example.com' LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.error('❌ Test user not found.');
      process.exit(1);
    }

    const testUser = userResult.rows[0];
    console.log(`✅ Found test user: ${testUser.username} (${testUser.id})\n`);

    // 2. Get all projects for test user
    const projectsResult = await db.query(
      `SELECT id, title, project_data FROM projects WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
      [testUser.id]
    );

    if (projectsResult.rows.length === 0) {
      console.log('❌ No projects found for test user');
      process.exit(0);
    }

    console.log(`📦 Found ${projectsResult.rows.length} projects:\n`);

    projectsResult.rows.forEach((project, index) => {
      console.log(`--- Project ${index + 1}: ${project.title} (${project.id}) ---`);
      
      const projectData = project.project_data;
      
      // Check patterns
      if (projectData.patterns) {
        const patterns = projectData.patterns;
        
        // Handle both array and object formats
        const patternsArray = Array.isArray(patterns) ? patterns : Object.values(patterns);
        console.log(`  Patterns: ${patternsArray.length} (${Array.isArray(patterns) ? 'array' : 'object'} format)`);
        
        patternsArray.forEach((pattern, index) => {
          const patternId = pattern.id || `pattern-${index}`;
          console.log(`    Pattern ${index}: ${patternId} (${pattern.name || 'unnamed'})`);
          console.log(`      Length: ${pattern.length || pattern.settings?.length || 'N/A'}`);
          
          // Check pattern data (notes)
          if (pattern.data) {
            const dataKeys = Object.keys(pattern.data);
            console.log(`      Data keys: ${dataKeys.length} (${dataKeys.join(', ')})`);
            
            let totalNotes = 0;
            dataKeys.forEach(instrumentId => {
              const notes = pattern.data[instrumentId];
              const noteCount = Array.isArray(notes) ? notes.length : 0;
              totalNotes += noteCount;
              if (noteCount > 0) {
                console.log(`        ${instrumentId}: ${noteCount} notes`);
                // Show first note as example
                if (notes.length > 0 && notes[0]) {
                  const firstNote = notes[0];
                  console.log(`          Example note: step=${firstNote.step || firstNote.start || 'N/A'}, pitch=${firstNote.pitch || firstNote.note || 'N/A'}`);
                }
              }
            });
            
            if (totalNotes === 0) {
              console.log(`      ⚠️  No notes in pattern data`);
            } else {
              console.log(`      ✅ Total notes: ${totalNotes}`);
            }
          } else {
            console.log(`      ⚠️  No pattern.data field`);
          }
        });
      } else {
        console.log(`  ⚠️  No patterns in project data`);
      }
      
      // Check active pattern
      if (projectData.active_pattern_id) {
        console.log(`  Active pattern: ${projectData.active_pattern_id}`);
      }
      
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking project patterns:', error);
    process.exit(1);
  }
}

checkProjectPatterns();

