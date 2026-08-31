import test from 'node:test';
import assert from 'node:assert/strict';

const { validateMutationRequest } = await import('../src/lib/security/request.ts');

function makeRequest(url, { origin, host } = {}) {
    const headers = new Headers();
    if (origin) headers.set('origin', origin);
    if (host) headers.set('host', host);
    return {
        url,
        headers,
    };
}

test('allows localhost same-site requests even without an Origin header', () => {
    process.env.APP_URL = 'https://example.com';
    const req = makeRequest('http://localhost:3000/api/auth/otp/request', { host: 'localhost:3000' });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.equal(response, null);
});

test('rejects mismatched external origins', () => {
    process.env.APP_URL = 'https://example.com';
    const req = makeRequest('https://example.com/api/auth/otp/request', {
        origin: 'https://evil.example',
        host: 'example.com',
    });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.ok(response);
    assert.equal(response.status, 403);
});
