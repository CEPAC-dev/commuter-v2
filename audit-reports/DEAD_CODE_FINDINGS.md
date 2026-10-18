# Dead Code Findings

## 1) Unused files (all)

package.json  (other)
scripts/audit-operational-regions.cjs  (scripts)
scripts/audit-request-groups.mjs  (scripts)
scripts/audit-station-region-migration.cjs  (scripts)
scripts/audit-station-regions.cjs  (scripts)
scripts/audit-user-regions.cjs  (scripts)
scripts/backfill-admin-permissions.cjs  (scripts)
scripts/backfill-kashier-payment-ledger.cjs  (scripts)
scripts/backfill-operational-regions.cjs  (scripts)
scripts/backfill-public-numbers.cjs  (scripts)
scripts/backfill-station-regions.cjs  (scripts)
scripts/backfill-user-regions.cjs  (scripts)
scripts/backfill-wallet-reserved.cjs  (scripts)
scripts/checkLegacyRequests.mjs  (scripts)
scripts/ensureIndexes.mjs  (scripts)
scripts/migrate-promo-code-discount-type.cjs  (scripts)
scripts/migrate-referral-balance-bonuses.cjs  (scripts)
scripts/seed-prod-data.cjs  (scripts)
scripts/seed-stations.cjs  (scripts)
scripts/sync-payment-indexes.cjs  (scripts)
src/app/api/trips/route.ts  (src)
src/app/api/upload/[filename]/route.ts  (src)
src/app/api/upload/route.ts  (src)
src/components/admin/ReferralUserOverrides.tsx  (src)
src/components/admin/RefundRequestsClient.tsx  (src)
src/components/admin/StationsClient.tsx  (src)
src/components/availability/AvailabilityMap.tsx  (src)
src/components/availability/AvailabilityMapOsm.tsx  (src)
src/components/create/CreateMap.tsx  (src)
src/components/create/TripCycle.tsx  (src)
src/components/landing/VehicleTypes.tsx  (src)
src/components/layout/BottomNav.tsx  (src)
src/components/layout/DriverBottomNav.tsx  (src)
src/components/layout/Header.tsx  (src)
src/components/layout/UserNavbar.tsx  (src)
src/components/map/PickupMap.tsx  (src)
src/components/map/PickupMapInner.tsx  (src)
src/components/map/PickupMapInnerOsm.tsx  (src)
src/components/map/mapIcons.ts  (src)
src/components/map/useRouteOSRM.ts  (src)
src/components/shared/AgeGateInput.tsx  (src)
src/components/shared/CodeConfirmInput.tsx  (src)
src/components/shared/FilterBar.tsx  (src)
src/components/shared/InfoTooltip.tsx  (src)
src/components/shared/PageHeader.tsx  (src)
src/components/shared/SaveAddressButton.tsx  (src)
src/components/shared/StatusPill.tsx  (src)
src/components/shared/StickySidebar.tsx  (src)
src/components/shared/TripChatButton.tsx  (src)
src/components/shared/WaitTimer.tsx  (src)
src/components/trips/VehicleSeatMap.tsx  (src)
src/lib/MapContext.tsx  (src)
src/lib/admin/waitingList.ts  (src)
src/lib/auth/permissions.ts  (src)
src/lib/auth/securityQuestion.ts  (src)
src/lib/auth/session.ts  (src)
src/lib/auth/smsOtp.ts  (src)
src/lib/auth/validation.ts  (src)
src/lib/cancellationPolicy.ts  (src)
src/lib/config/driver.ts  (src)
src/lib/config/driverPlaceholder.ts  (src)
src/lib/config/earnings.ts  (src)
src/lib/config/environment.ts  (src)
src/lib/config/regions.ts  (src)
src/lib/config/vehicles.ts  (src)
src/lib/config/verification.ts  (src)
src/lib/db/getVehicles.ts  (src)
src/lib/db/seedVehicles.ts  (src)
src/lib/email/sendContactEmail.ts  (src)
src/lib/environment.ts  (src)
src/lib/geo/stations.ts  (src)
src/lib/i18n/client.tsx  (src)
src/lib/i18n/config.ts  (src)
src/lib/i18n/index.ts  (src)
src/lib/leaflet.ts  (src)
src/lib/locale.client.tsx  (src)
src/lib/locale.ts  (src)
src/lib/maps/settings.ts  (src)
src/lib/mongodb.ts  (src)
src/lib/notifications/webPush.ts  (src)
src/lib/openrouteservice.ts  (src)
src/lib/osrm.ts  (src)
src/lib/passengerCancellationPolicy.ts  (src)
src/lib/payments/kashierPayout.ts  (src)
src/lib/payments/requestPaymentRecovery.ts  (src)
src/lib/payments/requestSettlement.ts  (src)
src/lib/payments/resolveBooking.ts  (src)
src/lib/payments/sessionTiming.ts  (src)
src/lib/pendingRequestHardening.ts  (src)
src/lib/promoCode.ts  (src)
src/lib/promoUsageRelease.ts  (src)
src/lib/referral.ts  (src)
src/lib/regions/resolveActiveRegion.ts  (src)
src/lib/requestPromoRelease.ts  (src)
src/lib/security/request.ts  (src)
src/lib/services/availability.ts  (src)
src/lib/services/booking-status.ts  (src)
src/lib/services/logActionHelpers.ts  (src)
src/lib/services/logService.ts  (src)
src/lib/services/profile.ts  (src)
src/lib/services/requests.ts  (src)
src/lib/services/rideService.ts  (src)
src/lib/services/tripEarnings.ts  (src)
src/lib/services/trips.ts  (src)
src/lib/smsmisr.ts  (src)
src/lib/stations/publishDataset.ts  (src)
src/lib/stations/validateGeoJson.ts  (src)
src/lib/storage/stationDatasetStorage.ts  (src)
src/lib/time/availabilityWindow.ts  (src)
src/lib/time/bookingDates.ts  (src)
src/lib/time/cairoTime.ts  (src)
src/lib/time/pickupWindow.ts  (src)
src/lib/tripBatchCreation.ts  (src)
src/lib/tripBooking.ts  (src)
src/lib/tripHistoryFilters.ts  (src)
src/lib/tripSpacingLockIndex.ts  (src)
src/lib/tripTabView.ts  (src)
src/lib/useMapState.ts  (src)
src/lib/validation/tripSpacing.ts  (src)
src/lib/wallet/wallet.ts  (src)
src/models/AdminReferralAuditLog.ts  (src)
src/models/AdminReferralCampaign.ts  (src)
src/models/AdminReferralUsage.ts  (src)
src/models/AdminSettings.ts  (src)
src/models/Availability.ts  (src)
src/models/Counter.ts  (src)
src/models/Driver.ts  (src)
src/models/Log.ts  (src)
src/models/MapSettings.ts  (src)
src/models/Message.ts  (src)
src/models/Notification.ts  (src)
src/models/NotificationTemplate.ts  (src)
src/models/PromoCode.ts  (src)
src/models/PromoCodeUsage.ts  (src)
src/models/PushSubscription.ts  (src)
src/models/Rating.ts  (src)
src/models/ReferralAuditLog.ts  (src)
src/models/ReferralSettings.ts  (src)
src/models/ReferralUsage.ts  (src)
src/models/RefundRequest.ts  (src)
src/models/Ride.ts  (src)
src/models/Station.ts  (src)
src/models/StationAuditLog.ts  (src)
src/models/StationDataset.ts  (src)
src/models/Trip.ts  (src)
src/models/User.ts  (src)
src/models/Vehicle.ts  (src)
src/models/Wallet.ts  (src)
src/models/WalletTransaction.ts  (src)
src/models/WithdrawalRequest.ts  (src)
src/types/Ride.ts  (src)
src/types/auth.ts  (src)
src/types/booking.ts  (src)
src/types/driver.ts  (src)
src/types/forms.ts  (src)
src/types/log.ts  (src)
src/types/shared.ts  (src)
src/types/user.ts  (src)

## 2) Unused dependencies and devDependencies

Unused dependencies: next-intl, rc-time-picker, react-time-picker
Unused devDependencies: @types/bcryptjs, tailwindcss

## 3) Unlisted dependencies (unique package names)

| Package | Files importing it | Examples |
| --- | ---: | --- |
| @next/env | 6 | scripts/backfill-public-numbers.cjs, scripts/audit-request-groups.mjs, scripts/checkLegacyRequests.mjs |
| dotenv | 7 | scripts/seed-stations.cjs, scripts/seed-prod-data.cjs, scripts/audit-station-regions.cjs |
| mongodb | 13 | scripts/seed-stations.cjs, scripts/seed-prod-data.cjs, scripts/audit-station-region-migration.cjs |
| server-only | 22 | src/lib/payments/requestSettlement.ts, src/lib/payments/requestPaymentRecovery.ts, src/lib/auth/session.ts |

## 4) Unused exports and types grouped by file (top 25 files)

- src/types/shared.ts (22): CycleDayRecord, CycleRequestCore, GenderPref, GeoLocation, GroupAction, GroupType, PRIVATE_SEAT_LABELS, PickupPoint, PrivateSeatPosition, RequestStatus, RideGroup, RideType, SEAT_COSTS, SEAT_LABELS, SeatId, SeatPreference, SeatType, SelectedSeat, TimeSlot, TripType, WalkMinutes, WeekDay
- src/lib/services/logActionHelpers.ts (11): logCustomAction, logDriverCancelled, logPaymentCompleted, logPaymentFailed, logPaymentInitiated, logTripCompleted, logTripCreated, logTripMatched, logTripStarted, logTripTimeout, logUserCancelled
- src/lib/config/regions.ts (9): LEGACY_REGION_ALIASES, LEGACY_REGION_CODES, LegacyRegionCode, REGION_SLUGS, RegionBounds, getRegionConfig, isVehicleAvailableInRegion, vehicleKeysForRegion, vehiclesForRegion
- src/lib/i18n/index.ts (7): DEFAULT_LOCALE, LOCALE_COOKIE, MessageKey, SUPPORTED_LOCALES, formatMoney, isLocale, parseLocale
- src/lib/services/logService.ts (7): deleteLog, getDriverActivityLogs, getLogById, getLogs, getTripLogHistory, getTripLogs, getUserActivityLogs
- src/lib/services/rideService.ts (6): ListDriverRidesOptions, addPassengerToRide, getActiveRideForDriver, getRideByAvailability, getRideByNumber, recalculateRoute
- src/lib/passengerCancellationPolicy.ts (3): PassengerCancellationTier, calendarDaysBeforeCairo, evaluatePassengerCancellationTier
- src/lib/payments/kashierPayout.ts (3): PayoutRecipient, PayoutResult, initiateKashierPayout
- src/components/trips/VehicleSeatMap.tsx (2): getVehicleChassisStyle, getVehicleSeatGrid
- src/lib/cancellationPolicy.ts (2): canModifyAvailability, getCutoffDateStr
- src/lib/config/vehicles.ts (2): RideType, computeTripPriceForSelection
- src/lib/config/verification.ts (2): VERIFICATION_METHODS, questionText
- src/lib/environment.ts (2): isProduction, runtimeEnvironment
- src/lib/i18n/config.ts (2): SUPPORTED_LOCALES, isLocale
- src/lib/leaflet.ts (2): LeafletModule, dashedLinePattern
- src/lib/openrouteservice.ts (2): ORSRoute, fetchRoute
- src/lib/payments/resolveBooking.ts (2): isStandaloneTripRecord, resolvePayableBookingWith
- src/lib/requestPromoRelease.ts (2): RequestPromoReleaseState, RequestPromoReleaseTrip
- src/lib/services/availability.ts (2): DayOfWeek, MAX_AVAILABILITY_MINUTES
- src/lib/time/pickupWindow.ts (2): ARRIVAL_SLOT_STEP_MIN, getArrivalSlots
- src/lib/wallet/wallet.ts (2): debitWallet, reserveWithdrawal
- src/models/Log.ts (2): LogDoc, LogSchema
- src/models/ReferralSettings.ts (2): REFERRAL_SETTINGS_ROLES, ReferralSettingsDoc
- src/models/Ride.ts (2): AssignedDriverSchema, RideDoc
- src/models/Trip.ts (2): StopSchema, TripDoc

## 5) Verification of each unused file and unused dependency

| Item | Verdict | Evidence |
| --- | --- | --- |
| package.json | NEEDS_CHECK | Only string/comment/test references found: AGENTS.md, docs/option-c-investigation.md, package-lock.json |
| scripts/audit-operational-regions.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/audit-operational-regions.cjs |
| scripts/audit-request-groups.mjs | FALSE_POSITIVE | Runtime/path references exist in tests/auditRequestGroups.test.mjs |
| scripts/audit-station-region-migration.cjs | NEEDS_CHECK | Found references in package.json |
| scripts/audit-station-regions.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/audit-station-regions.cjs |
| scripts/audit-user-regions.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/audit-user-regions.cjs |
| scripts/backfill-admin-permissions.cjs | NEEDS_CHECK | Only string/comment/test references found: PROJECT_MAP.md |
| scripts/backfill-kashier-payment-ledger.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-kashier-payment-ledger.cjs |
| scripts/backfill-operational-regions.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-operational-regions.cjs |
| scripts/backfill-public-numbers.cjs | NEEDS_CHECK | Found references in package.json |
| scripts/backfill-station-regions.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-station-regions.cjs |
| scripts/backfill-user-regions.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-user-regions.cjs |
| scripts/backfill-wallet-reserved.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-wallet-reserved.cjs |
| scripts/checkLegacyRequests.mjs | NEEDS_CHECK | Only string/comment/test references found: docs/option-c-investigation.md, docs/trip-only-booking.md, PROJECT_MAP.md |
| scripts/ensureIndexes.mjs | FALSE_POSITIVE | Runtime/path references exist in scripts/seed-prod-data.cjs |
| scripts/migrate-promo-code-discount-type.cjs | NEEDS_CHECK | Only string/comment/test references found: docs/option-c-investigation.md, PROJECT_MAP.md |
| scripts/migrate-referral-balance-bonuses.cjs | NEEDS_CHECK | Only string/comment/test references found: PROJECT_MAP.md |
| scripts/seed-prod-data.cjs | FALSE_POSITIVE | Runtime/path references exist in package.json, scripts/seed-prod-data.cjs, scripts/seed-prod-data.test.cjs |
| scripts/seed-stations.cjs | FALSE_POSITIVE | Runtime/path references exist in package.json, scripts/seed-stations.cjs |
| scripts/sync-payment-indexes.cjs | FALSE_POSITIVE | Runtime/path references exist in scripts/sync-payment-indexes.cjs |
| src/app/api/trips/route.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/app/api/upload/[filename]/route.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/app/api/upload/route.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/components/admin/ReferralUserOverrides.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/admin/ReferralUserOverrides.tsx |
| src/components/admin/RefundRequestsClient.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/admin/RefundRequestsClient.tsx |
| src/components/admin/StationsClient.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/admin/StationsClient.tsx |
| src/components/availability/AvailabilityMap.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/availability/AvailabilityMap.tsx, src/components/availability/AvailabilityMapOsm.tsx |
| src/components/availability/AvailabilityMapOsm.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/availability/AvailabilityMapOsm.tsx |
| src/components/create/CreateMap.tsx | NEEDS_CHECK | Only string/comment/test references found: docs/STATION_POINTS.md, plan-PrivateRideExport.prompt.md, plan-PrivateRides.prompt.md |
| src/components/create/TripCycle.tsx | NEEDS_CHECK | Only string/comment/test references found: docs/STATION_POINTS.md, plan-PrivateRideExport.prompt.md, plan-PrivateRides.prompt.md |
| src/components/landing/VehicleTypes.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/landing/VehicleTypes.tsx |
| src/components/layout/BottomNav.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/layout/BottomNav.tsx, src/components/layout/DriverBottomNav.tsx |
| src/components/layout/DriverBottomNav.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/layout/DriverBottomNav.tsx |
| src/components/layout/Header.tsx | FALSE_POSITIVE | Runtime/path references exist in next.config.ts |
| src/components/layout/UserNavbar.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/layout/UserNavbar.tsx |
| src/components/map/PickupMap.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/map/PickupMap.tsx, src/components/map/PickupMapInner.tsx, src/components/map/PickupMapInnerOsm.tsx |
| src/components/map/PickupMapInner.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/map/PickupMap.tsx, src/components/map/PickupMapInner.tsx, src/components/map/PickupMapInnerOsm.tsx |
| src/components/map/PickupMapInnerOsm.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/map/PickupMap.tsx, src/components/map/PickupMapInnerOsm.tsx |
| src/components/map/mapIcons.ts | NEEDS_CHECK | Only string/comment/test references found: PROJECT_MAP.md, tsconfig.tsbuildinfo |
| src/components/map/useRouteOSRM.ts | FALSE_POSITIVE | Runtime/path references exist in src/components/map/PickupMapInner.tsx, src/components/map/PickupMapInnerOsm.tsx, src/components/map/useRouteOSRM.ts |
| src/components/shared/AgeGateInput.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/AgeGateInput.tsx |
| src/components/shared/CodeConfirmInput.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/CodeConfirmInput.tsx |
| src/components/shared/FilterBar.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/FilterBar.tsx |
| src/components/shared/InfoTooltip.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/InfoTooltip.tsx |
| src/components/shared/PageHeader.tsx | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/availability/page.tsx, src/app/admin/dashboard/page.tsx, src/app/admin/maps/page.tsx |
| src/components/shared/SaveAddressButton.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/create/TripCycle.tsx |
| src/components/shared/StatusPill.tsx | FALSE_POSITIVE | Runtime/path references exist in src/app/my-trips/page.tsx, src/components/admin/transactions/TransactionsClient.tsx, src/components/shared/StatusPill.tsx |
| src/components/shared/StickySidebar.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/StickySidebar.tsx |
| src/components/shared/TripChatButton.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/TripChatButton.tsx |
| src/components/shared/WaitTimer.tsx | FALSE_POSITIVE | Runtime/path references exist in src/components/shared/WaitTimer.tsx |
| src/components/trips/VehicleSeatMap.tsx | FALSE_POSITIVE | Runtime/path references exist in src/app/my-trips/[id]/page.tsx, src/components/trips/DriverRideInteractiveClient.tsx, src/components/trips/VehicleSeatMap.tsx |
| src/lib/MapContext.tsx | FALSE_POSITIVE | Runtime/path references exist in src/lib/MapContext.tsx |
| src/lib/admin/waitingList.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/waiting-list/page.tsx, src/app/api/admin/settings/waiting-list/route.ts, src/app/api/admin/waiting-list/count/route.ts |
| src/lib/auth/permissions.ts | FALSE_POSITIVE | Runtime/path references exist in next.config.ts, scripts/audit-user-regions.cjs, scripts/backfill-admin-permissions.cjs |
| src/lib/auth/securityQuestion.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/login/page.tsx, src/app/admin/users/page.tsx, src/app/api/auth/change-password/route.ts |
| src/lib/auth/session.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, ACTION_CENTER.md, AGENTS.md |
| src/lib/auth/smsOtp.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/auth/change-password/route.ts, src/app/api/auth/forgot-password/route.ts, src/app/api/auth/otp/request/route.ts |
| src/lib/auth/validation.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER_SUMMARY.md, docs/option-c-investigation.md, package-lock.json |
| src/lib/cancellationPolicy.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/settings/route.ts, src/app/api/admin/waiting-list/route.ts, src/app/api/admin/waiting-list/[id]/route.ts |
| src/lib/config/driver.ts | NEEDS_CHECK | Only string/comment/test references found: .gitignore, ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md |
| src/lib/config/driverPlaceholder.ts | NEEDS_CHECK | Only string/comment/test references found: PROJECT_MAP.md, tsconfig.tsbuildinfo |
| src/lib/config/earnings.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/driver/trips/[id]/complete/route.ts, src/app/api/wallet/route.ts, src/app/api/wallet/withdraw/route.ts |
| src/lib/config/environment.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/audit-station-regions.cjs, scripts/seed-prod-data.cjs, scripts/seed-stations.cjs |
| src/lib/config/regions.ts | FALSE_POSITIVE | Runtime/path references exist in package.json, scripts/audit-operational-regions.cjs, scripts/audit-station-regions.cjs |
| src/lib/config/vehicles.ts | NEEDS_CHECK | Only string/comment/test references found: AGENTS.md, docs/option-c-investigation.md, docs/STATION_POINTS.md |
| src/lib/config/verification.ts | NEEDS_CHECK | Only string/comment/test references found: docs/option-c-investigation.md, docs/option-c-rollout.md, plan-apiWrapAndTypes.prompt.md |
| src/lib/db/getVehicles.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/vehicles/route.ts, src/app/api/admin/vehicles/[key]/route.ts |
| src/lib/db/seedVehicles.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/vehicles/route.ts, src/app/api/vehicles/route.ts, src/lib/db/getVehicles.ts |
| src/lib/email/sendContactEmail.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/contact/route.ts, src/lib/email/sendContactEmail.ts |
| src/lib/environment.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/audit-station-regions.cjs, scripts/seed-prod-data.cjs, scripts/seed-stations.cjs |
| src/lib/geo/stations.ts | NEEDS_CHECK | Found references in package.json |
| src/lib/i18n/client.tsx | NEEDS_CHECK | Only string/comment/test references found: .env.local, .tmp_admin_check.js, .tmp_check.js |
| src/lib/i18n/config.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, AGENTS.md, docs/option-c-investigation.md |
| src/lib/i18n/index.ts | NEEDS_CHECK | Only string/comment/test references found: .tmp_admin_check.js, .tmp_check.js, ACTION_CENTER.md |
| src/lib/leaflet.ts | FALSE_POSITIVE | Runtime/path references exist in package.json, src/app/admin/trips/page.tsx, src/app/globals.css |
| src/lib/locale.client.tsx | FALSE_POSITIVE | Runtime/path references exist in src/app/my-trips/[id]/error.tsx, src/app/profile/DriverProfileClient.tsx, src/app/profile/verification/DriverVerificationClient.tsx |
| src/lib/locale.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/dashboard/page.tsx, src/app/admin/signup/page.tsx, src/app/admin/trips/page.tsx |
| src/lib/maps/settings.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/migrate-referral-balance-bonuses.cjs, scripts/seed-prod-data.test.cjs, src/app/admin/maps/page.tsx |
| src/lib/mongodb.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, .tmp_admin_check.js, .tmp_check.js |
| src/lib/notifications/webPush.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/notifications/route.ts, src/app/api/push/vapid-public-key/route.ts, src/lib/notifications/adminActivity.ts |
| src/lib/openrouteservice.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/directions/route.ts, src/app/api/ors/route.ts, src/components/admin/OperationConsole.tsx |
| src/lib/osrm.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/getMatchData/route.ts, src/app/api/admin/stations/matrix/route.ts, src/app/api/directions/route.ts |
| src/lib/passengerCancellationPolicy.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/[id]/cancel/route.ts |
| src/lib/payments/kashierPayout.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/transactions/route.ts, src/app/api/payments/webhook/route.ts, src/app/api/wallet/withdraw/route.ts |
| src/lib/payments/requestPaymentRecovery.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/payments/webhook/route.ts, src/lib/payments/kashier.ts, src/lib/payments/requestPaymentRecovery.ts |
| src/lib/payments/requestSettlement.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/payments/session/route.ts, src/app/api/payments/webhook/route.ts, src/lib/payments/kashier.ts |
| src/lib/payments/resolveBooking.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/transactions/refund/reconcile/route.ts, src/app/api/admin/transactions/refund/route.ts, src/app/api/admin/transactions/[id]/route.ts |
| src/lib/payments/sessionTiming.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/payments/session/route.ts, src/lib/requestGroupCancellation.ts, tests/requestGroupCancellation.test.mjs |
| src/lib/pendingRequestHardening.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/payments/webhook/route.ts, src/app/api/trips/expire/route.ts, src/lib/payments/kashier.ts |
| src/lib/promoCode.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/migrate-promo-code-discount-type.cjs, src/app/admin/promo-codes/page.tsx, src/app/api/admin/promo-codes/route.ts |
| src/lib/promoUsageRelease.ts | FALSE_POSITIVE | Runtime/path references exist in src/lib/promoCode.ts, src/lib/promoUsageRelease.ts, tests/promoUsageRelease.test.mjs |
| src/lib/referral.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/check_referrals.ts, scripts/migrate-referral-balance-bonuses.cjs, src/app/admin/referral-settings/page.tsx |
| src/lib/regions/resolveActiveRegion.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/layout.tsx, src/app/admin/operation/page.tsx, src/app/admin/stations/page.tsx |
| src/lib/requestPromoRelease.ts | FALSE_POSITIVE | Runtime/path references exist in src/lib/promoCode.ts, src/lib/requestPromoRelease.ts, tests/requestGroupLifecycleVerification.test.mjs |
| src/lib/security/request.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md |
| src/lib/services/availability.ts | FALSE_POSITIVE | Runtime/path references exist in next.config.ts, scripts/audit-operational-regions.cjs |
| src/lib/services/booking-status.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/bookings/[id]/status/route.ts, src/app/api/requests/route.ts, src/app/checkout/callback/page.tsx |
| src/lib/services/logActionHelpers.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/driver/rides/[id]/accept/route.ts, src/app/api/driver/rides/[id]/reject/route.ts, src/app/api/trips/expire/route.ts |
| src/lib/services/logService.ts | FALSE_POSITIVE | Runtime/path references exist in src/lib/services/logActionHelpers.ts, src/lib/services/rideActionHelpers.ts |
| src/lib/services/profile.ts | FALSE_POSITIVE | Runtime/path references exist in next.config.ts, src/app/admin/rides/page.tsx |
| src/lib/services/requests.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/lib/services/rideService.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/addMatchedData/route.ts, src/app/api/admin/rides/route.ts, src/app/api/admin/rides/[id]/route.ts |
| src/lib/services/tripEarnings.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/driver/trips/[id]/complete/route.ts, src/app/api/wallet/route.ts |
| src/lib/services/trips.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER_SUMMARY.md, AGENTS.md, docs/option-c-investigation.md |
| src/lib/smsmisr.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/sms/balance/route.ts, src/app/api/auth/otp/request/route.ts, src/lib/smsmisr.ts |
| src/lib/stations/publishDataset.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/station-datasets/[id]/publish/route.ts, src/app/api/admin/station-datasets/[id]/rollback/route.ts |
| src/lib/stations/validateGeoJson.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/station-datasets/[id]/validate/route.ts, src/lib/stations/diffDataset.ts, tests/multi-region.test.mjs |
| src/lib/storage/stationDatasetStorage.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/station-datasets/from-file/route.ts, src/app/api/admin/station-datasets/upload/route.ts, src/app/api/admin/station-datasets/[id]/download/route.ts |
| src/lib/time/availabilityWindow.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/availability/route.ts, src/app/api/admin/availability/[id]/route.ts, src/app/api/driver/availability/route.ts |
| src/lib/time/bookingDates.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/route.ts, src/components/create/CreateClient.tsx, src/components/create/DatePicker.tsx |
| src/lib/time/cairoTime.ts | FALSE_POSITIVE | Runtime/path references exist in src/components/trips/TripHistoryControls.tsx, src/lib/admin/waitingList.ts, src/lib/cancellationPolicy.ts |
| src/lib/time/pickupWindow.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/route.ts |
| src/lib/tripBatchCreation.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/route.ts, src/lib/requestGroupCreation.ts, src/lib/tripBatchCreation.ts |
| src/lib/tripBooking.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/transactions/refund/route.ts, src/app/api/trips/route.ts, src/lib/tripBatchCreation.ts |
| src/lib/tripHistoryFilters.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/my-trips/history/page.tsx, src/components/trips/TripHistoryFilters.tsx, src/lib/services/trips.ts |
| src/lib/tripSpacingLockIndex.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/route.ts, tests/phase8bGuards.test.mjs |
| src/lib/tripTabView.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/my-trips/page.tsx, src/lib/tripTabView.ts, tests/tripTabView.test.mjs |
| src/lib/useMapState.ts | FALSE_POSITIVE | Runtime/path references exist in src/lib/MapContext.tsx, src/lib/useMapState.ts |
| src/lib/validation/tripSpacing.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/route.ts, src/app/api/trips/spacing/route.ts, src/components/create/CreateClient.tsx |
| src/lib/wallet/wallet.ts | FALSE_POSITIVE | Runtime/path references exist in next.config.ts |
| src/models/AdminReferralAuditLog.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/referral-campaigns/route.ts, src/lib/referral.ts, src/models/AdminReferralAuditLog.ts |
| src/models/AdminReferralCampaign.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/referral-campaigns/route.ts, src/components/admin/AdminReferralCampaigns.tsx, src/components/admin/ReferralSettingsForm.tsx |
| src/models/AdminReferralUsage.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/referral-campaigns/route.ts, src/lib/notifications/adminActivity.ts, src/lib/referral.ts |
| src/models/AdminSettings.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/settings/page.tsx, src/app/api/admin/settings/route.ts, src/app/api/admin/settings/waiting-list/route.ts |
| src/models/Availability.ts | FALSE_POSITIVE | Runtime/path references exist in next.config.ts, scripts/audit-operational-regions.cjs |
| src/models/Counter.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-public-numbers.cjs |
| src/models/Driver.ts | NEEDS_CHECK | Only string/comment/test references found: .gitignore, ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md |
| src/models/Log.ts | NEEDS_CHECK | Only string/comment/test references found: .gitignore, .tmp_admin_check.js, .tmp_check.js |
| src/models/MapSettings.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/maps/page.tsx, src/app/api/admin/maps/route.ts, src/app/api/trips/route.ts |
| src/models/Message.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/login/page.tsx, src/app/admin/notifications/page.tsx |
| src/models/Notification.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/alerts/page.tsx |
| src/models/NotificationTemplate.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/notifications/page.tsx, src/app/api/admin/notifications/templates/route.ts, src/app/api/admin/notifications/templates/[id]/route.ts |
| src/models/PromoCode.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/migrate-promo-code-discount-type.cjs, src/app/admin/promo-codes/page.tsx, src/app/api/admin/promo-codes/route.ts |
| src/models/PromoCodeUsage.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/migrate-promo-code-discount-type.cjs, src/app/api/admin/promo-codes/[id]/logs/route.ts, src/app/api/admin/waiting-list/[id]/route.ts |
| src/models/PushSubscription.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/push/subscriptions/route.ts, src/components/layout/NotificationCenter.tsx, src/lib/notifications/webPush.ts |
| src/models/Rating.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/trips/[id]/rating/route.ts, src/app/my-trips/page.tsx, src/app/my-trips/[id]/page.tsx |
| src/models/ReferralAuditLog.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/referral-campaigns/route.ts, src/app/api/admin/referral-settings/history/route.ts, src/app/api/admin/users/[id]/referral-unlimited/route.ts |
| src/models/ReferralSettings.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/admin/referral-settings/page.tsx, src/app/api/admin/referral-settings/route.ts, src/app/api/admin/users/search/route.ts |
| src/models/ReferralUsage.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/check_referrals.ts, src/app/admin/users/page.tsx, src/app/api/admin/referral/pending/route.ts |
| src/models/RefundRequest.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/refund-requests/route.ts, src/app/api/admin/refund-requests/[id]/approve/route.ts, src/app/api/admin/refund-requests/[id]/reject/route.ts |
| src/models/Ride.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/models/Station.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, docs/architecture/station-datasets.md |
| src/models/StationAuditLog.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/station-datasets/from-file/route.ts, src/app/api/admin/station-datasets/upload/route.ts, src/app/api/admin/station-datasets/[id]/download/route.ts |
| src/models/StationDataset.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/station-datasets/from-file/route.ts, src/app/api/admin/station-datasets/history/route.ts, src/app/api/admin/station-datasets/upload/route.ts |
| src/models/Trip.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/models/User.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, .tmp_admin_check.js, .tmp_check.js |
| src/models/Vehicle.ts | NEEDS_CHECK | Only string/comment/test references found: AGENTS.md, docs/option-c-investigation.md, docs/STATION_POINTS.md |
| src/models/Wallet.ts | FALSE_POSITIVE | Runtime/path references exist in next.config.ts |
| src/models/WalletTransaction.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/backfill-kashier-payment-ledger.cjs, scripts/check_referrals.ts, scripts/ensureIndexes.mjs |
| src/models/WithdrawalRequest.ts | FALSE_POSITIVE | Runtime/path references exist in src/app/api/admin/withdrawals/route.ts, src/app/api/admin/withdrawals/[id]/approve/route.ts, src/app/api/admin/withdrawals/[id]/reject/route.ts |
| src/types/Ride.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/types/auth.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, .gitignore, ACTION_CENTER.md |
| src/types/booking.ts | NEEDS_CHECK | Only string/comment/test references found: AGENTS.md, docs/option-c-investigation.md, docs/option-c-rollout.md |
| src/types/driver.ts | NEEDS_CHECK | Only string/comment/test references found: .gitignore, ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md |
| src/types/forms.ts | FALSE_POSITIVE | Runtime/path references exist in scripts/audit-station-region-migration.cjs, src/app/api/trips/route.ts |
| src/types/log.ts | NEEDS_CHECK | Only string/comment/test references found: .gitignore, .tmp_admin_check.js, .tmp_check.js |
| src/types/shared.ts | NEEDS_CHECK | Only string/comment/test references found: ACTION_CENTER.md, ACTION_CENTER_SUMMARY.md, AGENTS.md |
| src/types/user.ts | NEEDS_CHECK | Only string/comment/test references found: .env.local, .tmp_admin_check.js, .tmp_check.js |
| next-intl | FALSE_POSITIVE | Found runtime usage in package-lock.json, package.json, src/components/layout/BottomNav.tsx |
| rc-time-picker | FALSE_POSITIVE | Found runtime usage in package-lock.json, package.json |
| react-time-picker | FALSE_POSITIVE | Found runtime usage in package-lock.json, package.json |
| @types/bcryptjs | FALSE_POSITIVE | Found runtime usage in .tmp_admin_check.js, package-lock.json, package.json |
| tailwindcss | FALSE_POSITIVE | Found runtime usage in package-lock.json, package.json, src/app/globals.css |
