const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveConfig } = require('./seed-prod-data.cjs');

test('resolveConfig prefers explicit target settings and derives defaults', () => {
    const config = resolveConfig({
        SOURCE_MONGODB_URI: 'mongodb://source.example:27017',
        TARGET_MONGODB_URI: 'mongodb://target.example:27017',
        SOURCE_DB_NAME: 'source-db',
        TARGET_DB_NAME: 'target-db',
    });

    assert.equal(config.sourceUri, 'mongodb://source.example:27017');
    assert.equal(config.targetUri, 'mongodb://target.example:27017');
    assert.equal(config.sourceDbName, 'source-db');
    assert.equal(config.targetDbName, 'target-db');
});

test('resolveConfig falls back to MONGODB_URI and DB_NAME', () => {
    const config = resolveConfig({
        MONGODB_URI: 'mongodb://shared.example:27017',
        DB_NAME: 'shared-db',
    });

    assert.equal(config.sourceUri, 'mongodb://shared.example:27017');
    assert.equal(config.targetUri, 'mongodb://shared.example:27017');
    assert.equal(config.sourceDbName, 'shared-db');
    assert.equal(config.targetDbName, 'shared-db');
});
