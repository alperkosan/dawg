import pkg from 'pg';
const { Client } = pkg;

async function checkPresets() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/dawg'
    });

    try {
        await client.connect();
        const res = await client.query('SELECT id, name, is_public FROM presets');
        console.log('TOTAL PRESETS IN DB:', res.rowCount);
        res.rows.forEach(r => console.log(`- [${r.is_public ? 'PUBLIC' : 'PRIVATE'}] ${r.name} (${r.id})`));
    } catch (err) {
        console.error('DB ERROR:', err);
    } finally {
        await client.end();
    }
}

checkPresets();
