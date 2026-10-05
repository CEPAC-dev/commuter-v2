import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildPendingRequestExpiryFilter,
  buildPendingTripExpiryFilter,
  buildSettlementRequestFilter,
  isSettlementBlockedStatus,
} = await import('../src/lib/pendingRequestHardening.ts');

test('pending request expiry filter is parent-status driven', () => {
  const cutoff = new Date('2026-09-28T10:00:00.000Z');
  assert.deepEqual(buildPendingRequestExpiryFilter(cutoff), {
    status: 'pending_payment',
    paymentStatus: { $in: ['pending', 'failed'] },
    createdAt: { $lte: cutoff },
  });
});

test('trip expiry filter requires selected parent request ids and pending trip status', () => {
  assert.deepEqual(buildPendingTripExpiryFilter(['request-a', 'request-b']), {
    requestId: { $in: ['request-a', 'request-b'] },
    status: 'pending_payment',
  });
});

test('settlement filter excludes waiting-list and rejected requests', () => {
  assert.deepEqual(buildSettlementRequestFilter('booking-id'), {
    _id: 'booking-id',
    paymentStatus: { $in: ['pending', 'failed'] },
    status: { $nin: ['waiting_list', 'rejected'] },
  });
  assert.equal(isSettlementBlockedStatus('waiting_list'), true);
  assert.equal(isSettlementBlockedStatus('rejected'), true);
  assert.equal(isSettlementBlockedStatus('approved'), false);
  assert.equal(isSettlementBlockedStatus('pending_payment'), false);
});
