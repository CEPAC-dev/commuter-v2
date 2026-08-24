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
const bcrypt = require('bcryptjs');
(async () => {
    const client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    const db = client.db(env.DB_NAME || 'commuter-ae');
    const users = db.collection('users');
    const adminDocs = await users.find({ role: 'admin' }).project({ phone: 1, email: 1, passwordHash: 1, name: 1 }).toArray();
    console.log('admins', JSON.stringify(adminDocs, null, 2));
    for (const doc of adminDocs) {
        console.log('phone=', doc.phone, 'hash=', !!doc.passwordHash, 'compare=', await bcrypt.compare('admin123', doc.passwordHash || ''));
    }
    await client.close();
})();
