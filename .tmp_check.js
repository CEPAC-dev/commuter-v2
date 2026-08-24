const fs = require('fs');
const path = require('path');
const env = {};
const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    env[key] = value;
}
const { MongoClient } = require('mongodb');
(async () => {
    const client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    const db = client.db(env.DB_NAME || 'commuter-ae');
    const collections = await db.listCollections().toArray();
    console.log('collections', collections.map((c) => c.name));

    const users = db.collection('users');
    const admins = await users.find({ role: 'admin' }).project({ name: 1, phone: 1, email: 1, role: 1 }).limit(10).toArray();
    console.log('admins', admins);

    const coll = db.collection('availabilities');
    console.log('availability total', await coll.countDocuments({}));
    const q = await coll.find({ date: '2026-08-19' }).limit(10).toArray();
    console.log('matches', q.length);
    console.log(JSON.stringify(q.slice(0, 2), null, 2));
    await client.close();
})();
