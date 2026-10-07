import test from 'node:test';
import assert from 'node:assert/strict';

const { validateMutationRequest } = await import('../src/lib/security/request.ts');

function makeRequest(url, { origin, host, contentType } = {}) {
    const headers = new Headers();
    if (origin) headers.set('origin', origin);
    if (host) headers.set('host', host);
    if (contentType) headers.set('content-type', contentType);
    return {
        url,
        headers,
    };
}

test('allows localhost same-site requests even without an Origin header', () => {
    process.env.APP_URL = 'https://example.com';
    const req = makeRequest('http://localhost:3000/api/auth/otp/request', {
        host: 'localhost:3000',
        contentType: 'application/json',
    });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.equal(response, null);
});

test('rejects mismatched external origins', () => {
    process.env.APP_URL = 'https://example.com';
    const req = makeRequest('https://example.com/api/auth/otp/request', {
        origin: 'https://evil.example',
        host: 'example.com',
        contentType: 'application/json',
    });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.ok(response);
    assert.equal(response.status, 403);
});

test('requires JSON Content-Type for localhost requests', () => {
    // Keep the origin valid so this specifically exercises the JSON content-type guard.
    const req = makeRequest('http://localhost:3000/api/auth/otp/request', {
        host: 'localhost:3000',
    });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.ok(response);
    assert.equal(response.status, 415);
});

test('rejects a mismatched Origin before checking the request content type', () => {
    // Ensure the mismatch is rejected by origin policy, not by the JSON header check.
    const req = makeRequest('https://example.com/api/auth/otp/request', {
        origin: 'https://evil.example',
        host: 'example.com',
        contentType: 'application/json',
    });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.ok(response);
    assert.equal(response.status, 403);
});

test('rejects a non-localhost request with no Origin header', () => {
    // Missing Origin is allowed only for local development origins.
    const req = makeRequest('https://example.com/api/auth/otp/request', {
        host: 'example.com',
        contentType: 'application/json',
    });

    const response = validateMutationRequest(req, { requireJson: true });

    assert.ok(response);
    assert.equal(response.status, 403);
});
