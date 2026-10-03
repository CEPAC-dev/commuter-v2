import test from 'node:test';
import assert from 'node:assert/strict';

const {
  WAITING_LIST_PASSENGER_SELECT,
  buildWaitingListApprovedNotification,
  buildWaitingListCreatedAdminNotifications,
  buildWaitingListRejectedNotification,
  buildWaitingListReviewUpdate,
  buildWaitingListTransitionFilter,
  getSharedRideWaitingListEnabled,
  groupPromoUsageCounts,
  hasPastWaitingListTrip,
  mapWaitingListRequest,
  shouldCreateWaitingListRequest,
  validateWaitingListAction,
} = await import('../src/lib/admin/waitingList.ts');
const {
  formatAdminBadgeCount,
  formatWaitingListAge,
  waitingListErrorKey,
} = await import('../src/lib/admin/waitingListUi.ts');

test('validates approve and reject actions and reasons', () => {
  assert.deepEqual(validateWaitingListAction({ action: 'approve' }), {
    ok: true,
    value: { action: 'approve' },
  });
  assert.deepEqual(validateWaitingListAction({ action: 'reject', reason: '  Not available  ' }), {
    ok: true,
    value: { action: 'reject', reason: 'Not available' },
  });
  assert.equal(validateWaitingListAction({ action: 'archive' }).ok, false);
  assert.equal(validateWaitingListAction({ action: 'approve', reason: 'not allowed' }).ok, false);
  assert.equal(validateWaitingListAction({ action: 'reject', reason: 123 }).ok, false);
  assert.equal(validateWaitingListAction({ action: 'reject', reason: 'x'.repeat(501) }).ok, false);
});

test('waiting-list transition is conditional on waiting_list', () => {
  assert.deepEqual(buildWaitingListTransitionFilter('request-id'), {
    _id: 'request-id',
    status: 'waiting_list',
  });
  assert.deepEqual(
    buildWaitingListReviewUpdate('approve', 'admin-id', new Date('2026-09-28T12:00:00.000Z')),
    {
      $set: {
        status: 'approved',
        reviewedBy: 'admin-id',
        reviewedAt: new Date('2026-09-28T12:00:00.000Z'),
      },
    },
  );
});

test('waiting-list creation requires both an enabled feature and a shared ride', () => {
  assert.equal(shouldCreateWaitingListRequest(true, true), true);
  assert.equal(shouldCreateWaitingListRequest(true, false), false);
  assert.equal(shouldCreateWaitingListRequest(false, true), false);
  assert.equal(shouldCreateWaitingListRequest(false, false), false);
  assert.equal(getSharedRideWaitingListEnabled(undefined), true);
  assert.equal(getSharedRideWaitingListEnabled(null), true);
  assert.equal(getSharedRideWaitingListEnabled(false), false);
});

test('passenger projection and response mapping exclude sensitive fields', () => {
  assert.equal(WAITING_LIST_PASSENGER_SELECT.includes('password'), false);
  assert.equal(WAITING_LIST_PASSENGER_SELECT.includes('wallet'), false);
  const mapped = mapWaitingListRequest({
    request: { _id: 'request-id', createdAt: '2026-09-28T12:00:00.000Z', amountEgp: 100, note: 'note' },
    passenger: { name: 'Passenger', phone: '0100', email: 'passenger@example.com', password: 'secret', wallet: { balanceEgp: 500 } },
    trips: [],
    promoCodes: [],
    hasPastTrip: false,
  });
  assert.deepEqual(mapped.passenger, {
    name: 'Passenger',
    phone: '0100',
    email: 'passenger@example.com',
  });
  assert.equal('password' in mapped.passenger, false);
  assert.equal('wallet' in mapped.passenger, false);
  assert.equal(mapped.hasPastTrip, false);
});

test('promo release grouping is empty when a request has no promo usage', () => {
  assert.deepEqual([...groupPromoUsageCounts([])], []);
});

test('past-trip helper uses the booking pickup date and time', () => {
  const now = { dateStr: '2026-09-28', timeStr: '12:00' };
  assert.equal(hasPastWaitingListTrip([{ date: '2026-09-27', pickupTime: '23:59' }], now), true);
  assert.equal(hasPastWaitingListTrip([{ date: '2026-09-28', pickupTime: '11:59' }], now), true);
  assert.equal(hasPastWaitingListTrip([{ date: '2026-09-28', pickupTime: '12:00' }], now), false);
  assert.equal(hasPastWaitingListTrip([{ date: '2026-09-29', pickupTime: '08:00' }], now), false);
});

test('waiting-list notification payloads use links and omit passenger contact data', () => {
  const adminPayload = buildWaitingListCreatedAdminNotifications({
    adminIds: ['admin-a', 'admin-b'],
    bookingId: 'request-id',
    routeSummary: 'Pickup to Dropoff',
    date: '2026-09-29',
  });
  assert.equal(adminPayload.length, 2);
  assert.equal(adminPayload[0].data.linkUrl, '/admin/waiting-list');
  assert.equal('phone' in adminPayload[0].data, false);
  assert.equal('email' in adminPayload[0].data, false);

  const approved = buildWaitingListApprovedNotification('passenger-id', 'request-id');
  assert.equal(approved.data.linkUrl, '/my-requests/request-id');

  const rejectedWithoutReason = buildWaitingListRejectedNotification('passenger-id', 'request-id', '   ');
  assert.equal(rejectedWithoutReason.body.includes('Reason:'), false);
  assert.equal(rejectedWithoutReason.bodyAr.includes('السبب:'), false);

  const rejectedWithReason = buildWaitingListRejectedNotification('passenger-id', 'request-id', 'No seats');
  assert.equal(rejectedWithReason.body.includes('No seats'), true);
  assert.equal(rejectedWithReason.bodyAr.includes('No seats'), true);
});

test('waiting-list UI helpers format age, errors, and badge counts', () => {
  const now = Date.parse('2026-09-28T12:00:00.000Z');
  assert.deepEqual(formatWaitingListAge('2026-09-28T11:59:30.000Z', now), { unit: 'justNow', count: 0 });
  assert.deepEqual(formatWaitingListAge('2026-09-28T10:30:00.000Z', now), { unit: 'hours', count: 1 });
  assert.equal(waitingListErrorKey(409, 'WAITING_LIST_TRIP_IN_PAST'), 'waitingListErrorPastTrip');
  assert.equal(waitingListErrorKey(403), 'waitingListErrorForbidden');
  assert.equal(formatAdminBadgeCount(0), null);
  assert.equal(formatAdminBadgeCount(100), '99+');
});
