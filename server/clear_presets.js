import pkg from 'pg';
const { Client } = pkg;

async function clearPresets() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/dawg'
    });

    try {
        await client.connect();
        console.log('Connecting to database...');

        // Truncate presets table. CASCADE will also clear preset_ratings and user_preset_downloads
        const res = await client.query('TRUNCATE TABLE presets RESTART IDENTITY CASCADE');
        console.log('✅ PRESETS TABLE CLEARED');

        // Also clear collections if any
        await client.query('TRUNCATE TABLE preset_collections RESTART IDENTITY CASCADE');
        console.log('✅ PRESET COLLECTIONS TABLE CLEARED');

    } catch (err) {
        console.error('❌ DB ERROR:', err);
    } finally {
        await client.end();
    }
}

clearPresets();
