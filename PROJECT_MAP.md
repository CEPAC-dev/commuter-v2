# Project map

## 1) Stack and architecture

- Frontend: Next.js 16.2.9, React 19, TypeScript, Tailwind CSS v4, App Router (`src/app/**`), Zustand for client state.
- Backend/API: Next.js route handlers under `src/app/api/**`, server-side logic in `src/lib/**`, MongoDB via `mongoose`, JWT via `jose`, password hashing via `bcryptjs`.
- Package manager: npm (`package-lock.json`, `package.json` scripts).
- Other libraries: `date-fns`, `lucide-react`, `motion`, `@react-google-maps/api`, `leaflet`, `qrcode.react`, `react-hot-toast`, `web-push`, `exceljs`, `jszip`, `resend`, `nodemailer`, `zustand`.
- Structure: full-stack App Router monolith with frontend pages/components, backend route handlers, shared libraries, models, scripts, and tests.

## 2) Root + folder structure

Top-level source directories by folder:

- eslint.config.mjs/
- next-env.d.ts/
- next.config.ts/
- postcss.config.mjs/
- scripts/
- src/
- tests/

## 3) Source file inventory

### App Root

#### `src/app/availability/AvailabilityClient.tsx`
- Description: Route module for availability
- Exports/defines: default, AvailabilityClient, function
- Imported by: src/app/availability/page.tsx

#### `src/app/manifest.ts`
- Description: Route module for 
- Exports/defines: default, manifest, function
- Imported by: none found

#### `src/app/profile/DriverProfileClient.tsx`
- Description: Route module for profile
- Exports/defines: default, DriverProfileClient, function
- Imported by: src/app/profile/page.tsx

#### `src/app/profile/ProfileClient.tsx`
- Description: Route module for profile
- Exports/defines: default, ProfileClient, function
- Imported by: src/app/profile/page.tsx

#### `src/app/profile/verification/DriverVerificationClient.tsx`
- Description: Route module for profile/verification
- Exports/defines: default, DriverVerificationClient, function
- Imported by: src/app/profile/verification/page.tsx

#### `src/app/robots.ts`
- Description: Route module for 
- Exports/defines: default, robots, function
- Imported by: none found

#### `src/app/sitemap.ts`
- Description: Route module for 
- Exports/defines: default, sitemap, function
- Imported by: none found


### App Pages

#### `src/app/[region]/admin/layout.tsx`
- Description: App layout for [region]/admin
- Exports/defines: default, RegionalAdminLayout, function
- Imported by: none found

#### `src/app/[region]/admin/operation/page.tsx`
- Description: Next.js page component for [region]/admin/operation
- Exports/defines: default, RegionalAdminOperationPage, function
- Imported by: none found

#### `src/app/[region]/admin/stations/page.tsx`
- Description: Next.js page component for [region]/admin/stations
- Exports/defines: default, StationsPage, function
- Imported by: none found

#### `src/app/activity/page.tsx`
- Description: Next.js page component for activity
- Exports/defines: default, ActivityRedirect, function, dynamic
- Imported by: none found

#### `src/app/admin/alerts/page.tsx`
- Description: Next.js page component for admin/alerts
- Exports/defines: default, AdminAlertsPage, function, dynamic
- Imported by: none found

#### `src/app/admin/availability/page.tsx`
- Description: Next.js page component for admin/availability
- Exports/defines: default, AdminAvailabilityPage, function
- Imported by: none found

#### `src/app/admin/dashboard/page.tsx`
- Description: Next.js page component for admin/dashboard
- Exports/defines: default, AdminDashboardPage, function
- Imported by: none found

#### `src/app/admin/layout.tsx`
- Description: App layout for admin
- Exports/defines: default, AdminLayout, function
- Imported by: none found

#### `src/app/admin/login/page.tsx`
- Description: Next.js page component for admin/login
- Exports/defines: default, AdminLoginPage, function
- Imported by: none found

#### `src/app/admin/maps/page.tsx`
- Description: Next.js page component for admin/maps
- Exports/defines: default, AdminMapsPage, function
- Imported by: none found

#### `src/app/admin/notifications/page.tsx`
- Description: Next.js page component for admin/notifications
- Exports/defines: default, AdminNotificationsPage, function, dynamic
- Imported by: none found

#### `src/app/admin/operation/page.tsx`
- Description: Next.js page component for admin/operation
- Exports/defines: default, AdminOperationPage, function
- Imported by: none found

#### `src/app/admin/page.tsx`
- Description: Next.js page component for admin
- Exports/defines: default, AdminPage, function
- Imported by: none found

#### `src/app/admin/promo-codes/page.tsx`
- Description: Next.js page component for admin/promo-codes
- Exports/defines: default, AdminPromoCodesPage, function, metadata
- Imported by: none found

#### `src/app/admin/referral-settings/page.tsx`
- Description: Next.js page component for admin/referral-settings
- Exports/defines: default, AdminReferralSettingsPage, function, metadata
- Imported by: none found

#### `src/app/admin/rides/page.tsx`
- Description: Next.js page component for admin/rides
- Exports/defines: default, AdminRidesPage, function
- Imported by: none found

#### `src/app/admin/settings/page.tsx`
- Description: Next.js page component for admin/settings
- Exports/defines: default, AdminSettingsPage, function
- Imported by: none found

#### `src/app/admin/signup/page.tsx`
- Description: Next.js page component for admin/signup
- Exports/defines: default, AdminSignupPage, function
- Imported by: none found

#### `src/app/admin/stations/page.tsx`
- Description: Next.js page component for admin/stations
- Exports/defines: default, AdminStationsRedirect, function
- Imported by: none found

#### `src/app/admin/transactions/[id]/page.tsx`
- Description: Next.js page component for admin/transactions/[id]
- Exports/defines: default, AdminTransactionDetailPage, function, dynamic
- Imported by: none found

#### `src/app/admin/transactions/page.tsx`
- Description: Next.js page component for admin/transactions
- Exports/defines: default, AdminTransactionsPage, function, dynamic
- Imported by: none found

#### `src/app/admin/trips/page.tsx`
- Description: Next.js page component for admin/trips
- Exports/defines: default, AdminTripsPage, function
- Imported by: none found

#### `src/app/admin/users/page.tsx`
- Description: Next.js page component for admin/users
- Exports/defines: default, AdminUsersPage, function
- Imported by: none found

#### `src/app/admin/vehicles/page.tsx`
- Description: Next.js page component for admin/vehicles
- Exports/defines: default, AdminVehiclesPage, function, metadata
- Imported by: none found

#### `src/app/admin/waiting-list/page.tsx`
- Description: Next.js page component for admin/waiting-list
- Exports/defines: default, AdminWaitingListPage, function, dynamic
- Imported by: none found

#### `src/app/admin/withdrawals/page.tsx`
- Description: Next.js page component for admin/withdrawals
- Exports/defines: default, AdminWithdrawalsPage, function
- Imported by: none found

#### `src/app/availability/page.tsx`
- Description: Next.js page component for availability
- Exports/defines: default, AvailabilityPage, function, metadata
- Imported by: none found

#### `src/app/checkout/callback/page.tsx`
- Description: Next.js page component for checkout/callback
- Exports/defines: default, CallbackPage, function, metadata, dynamic
- Imported by: none found

#### `src/app/contact/page.tsx`
- Description: Next.js page component for contact
- Exports/defines: default, ContactPage, function, metadata
- Imported by: none found

#### `src/app/create/page.tsx`
- Description: Next.js page component for create
- Exports/defines: default, CreatePage, function
- Imported by: none found

#### `src/app/faq/page.tsx`
- Description: Next.js page component for faq
- Exports/defines: default, FAQPage, function, metadata
- Imported by: none found

#### `src/app/forgot-password/page.tsx`
- Description: Next.js page component for forgot-password
- Exports/defines: default, ForgotPasswordPage, function
- Imported by: none found

#### `src/app/layout.tsx`
- Description: App layout for 
- Exports/defines: default, RootLayout, function, metadata
- Imported by: none found

#### `src/app/login/page.tsx`
- Description: Next.js page component for login
- Exports/defines: default, LoginPage, function
- Imported by: none found

#### `src/app/my-requests/[id]/page.tsx`
- Description: Next.js page component for my-requests/[id]
- Exports/defines: default, MyRequestRedirectPage, function, dynamic
- Imported by: none found

#### `src/app/my-requests/page.tsx`
- Description: Next.js page component for my-requests
- Exports/defines: default, MyRequestsRedirectPage, function, dynamic
- Imported by: none found

#### `src/app/my-trips/[id]/error.tsx`
- Description: Error boundary for my-trips/[id]
- Exports/defines: default, TripDetailError, function
- Imported by: none found

#### `src/app/my-trips/[id]/loading.tsx`
- Description: Loading UI for my-trips/[id]
- Exports/defines: default, TripDetailLoading, function
- Imported by: none found

#### `src/app/my-trips/[id]/page.tsx`
- Description: Next.js page component for my-trips/[id]
- Exports/defines: default, TripDetailPage, function, metadata, dynamic
- Imported by: none found

#### `src/app/my-trips/history/page.tsx`
- Description: Next.js page component for my-trips/history
- Exports/defines: default, TripHistoryPage, function, dynamic
- Imported by: none found

#### `src/app/my-trips/loading.tsx`
- Description: Loading UI for my-trips
- Exports/defines: default, MyTripsLoading, function
- Imported by: none found

#### `src/app/my-trips/page.tsx`
- Description: Next.js page component for my-trips
- Exports/defines: default, MyTripsPage, function, metadata, dynamic
- Imported by: none found

#### `src/app/page.tsx`
- Description: Next.js page component for 
- Exports/defines: default, Home, function
- Imported by: none found

#### `src/app/profile/page.tsx`
- Description: Next.js page component for profile
- Exports/defines: default, ProfilePage, function, metadata
- Imported by: none found

#### `src/app/profile/verification/page.tsx`
- Description: Next.js page component for profile/verification
- Exports/defines: default, DriverVerificationPage, function, metadata
- Imported by: none found

#### `src/app/ride-requests/page.tsx`
- Description: Next.js page component for ride-requests
- Exports/defines: default, RideRequestsPage, function, metadata, dynamic
- Imported by: none found

#### `src/app/terms/layout.tsx`
- Description: App layout for terms
- Exports/defines: default, TermsLayout, function, metadata
- Imported by: none found

#### `src/app/terms/page.tsx`
- Description: Next.js page component for terms
- Exports/defines: default, TermsPage, function
- Imported by: none found

#### `src/app/user/notifications/loading.tsx`
- Description: Loading UI for user/notifications
- Exports/defines: default, Loading, function
- Imported by: none found

#### `src/app/user/notifications/page.tsx`
- Description: Next.js page component for user/notifications
- Exports/defines: default, NotificationsPage, function, metadata, dynamic
- Imported by: none found

#### `src/app/wallet/page.tsx`
- Description: Next.js page component for wallet
- Exports/defines: default, WalletPage, function, metadata, dynamic
- Imported by: none found


### App Api

#### `src/app/api/actions/ride/[rideId]/route.ts`
- Description: API route for actions/ride/[rideId]
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/actions/route.ts`
- Description: API route for actions
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/activity-notifications/route.ts`
- Description: API route for admin/activity-notifications
- Exports/defines: GET, PATCH
- Imported by: none found

#### `src/app/api/admin/addMatchedData/route.ts`
- Description: API route for admin/addMatchedData
- Exports/defines: POST, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/availability/[id]/route.ts`
- Description: API route for admin/availability/[id]
- Exports/defines: GET, PATCH, DELETE
- Imported by: none found

#### `src/app/api/admin/availability/export/route.ts`
- Description: API route for admin/availability/export
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/availability/restore/route.ts`
- Description: API route for admin/availability/restore
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/availability/route.ts`
- Description: API route for admin/availability
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/admin/drivers/[id]/wallet-settings/route.ts`
- Description: API route for admin/drivers/[id]/wallet-settings
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/admin/drivers/route.ts`
- Description: API route for admin/drivers
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/getDriverRequests/route.ts`
- Description: API route for admin/getDriverRequests
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/getMatchData/route.ts`
- Description: API route for admin/getMatchData
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/getPrivateRideRequests/route.ts`
- Description: API route for admin/getPrivateRideRequests
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/getSharedRideRequests/route.ts`
- Description: API route for admin/getSharedRideRequests
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/login/route.ts`
- Description: API route for admin/login
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/maps/route.ts`
- Description: API route for admin/maps
- Exports/defines: GET, PUT
- Imported by: none found

#### `src/app/api/admin/match-ride/route.ts`
- Description: API route for admin/match-ride
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/notifications/route.ts`
- Description: API route for admin/notifications
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/admin/notifications/templates/[id]/route.ts`
- Description: API route for admin/notifications/templates/[id]
- Exports/defines: PATCH, DELETE
- Imported by: none found

#### `src/app/api/admin/notifications/templates/route.ts`
- Description: API route for admin/notifications/templates
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/admin/promo-codes/[id]/logs/route.ts`
- Description: API route for admin/promo-codes/[id]/logs
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/promo-codes/[id]/route.ts`
- Description: API route for admin/promo-codes/[id]
- Exports/defines: PATCH, DELETE
- Imported by: none found

#### `src/app/api/admin/promo-codes/route.ts`
- Description: API route for admin/promo-codes
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/admin/referral-campaigns/route.ts`
- Description: API route for admin/referral-campaigns
- Exports/defines: GET, PUT
- Imported by: none found

#### `src/app/api/admin/referral-settings/history/route.ts`
- Description: API route for admin/referral-settings/history
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/referral-settings/route.ts`
- Description: API route for admin/referral-settings
- Exports/defines: GET, PUT
- Imported by: none found

#### `src/app/api/admin/referral/[referralUsageId]/reconcile/route.ts`
- Description: API route for admin/referral/[referralUsageId]/reconcile
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/referral/pending/route.ts`
- Description: API route for admin/referral/pending
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/referral/reconcile/route.ts`
- Description: API route for admin/referral/reconcile
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/refund-requests/[id]/approve/route.ts`
- Description: API route for admin/refund-requests/[id]/approve
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/refund-requests/[id]/reject/route.ts`
- Description: API route for admin/refund-requests/[id]/reject
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/refund-requests/route.ts`
- Description: API route for admin/refund-requests
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/rides/[id]/reassign/route.ts`
- Description: API route for admin/rides/[id]/reassign
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/admin/rides/[id]/route.ts`
- Description: API route for admin/rides/[id]
- Exports/defines: GET, PATCH, DELETE
- Imported by: none found

#### `src/app/api/admin/rides/purge-today/route.ts`
- Description: API route for admin/rides/purge-today
- Exports/defines: DELETE
- Imported by: none found

#### `src/app/api/admin/rides/purge/route.ts`
- Description: API route for admin/rides/purge
- Exports/defines: DELETE
- Imported by: none found

#### `src/app/api/admin/rides/route.ts`
- Description: API route for admin/rides
- Exports/defines: GET, DELETE
- Imported by: none found

#### `src/app/api/admin/settings/route.ts`
- Description: API route for admin/settings
- Exports/defines: GET, PUT
- Imported by: none found

#### `src/app/api/admin/settings/waiting-list/route.ts`
- Description: API route for admin/settings/waiting-list
- Exports/defines: GET, PATCH
- Imported by: none found

#### `src/app/api/admin/shiftDates/route.ts`
- Description: API route for admin/shiftDates
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/signup/route.ts`
- Description: API route for admin/signup
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/sms/balance/route.ts`
- Description: API route for admin/sms/balance
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/station-datasets/[id]/download/route.ts`
- Description: API route for admin/station-datasets/[id]/download
- Exports/defines: GET, runtime
- Imported by: none found

#### `src/app/api/admin/station-datasets/[id]/preview/route.ts`
- Description: API route for admin/station-datasets/[id]/preview
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/station-datasets/[id]/publish/route.ts`
- Description: API route for admin/station-datasets/[id]/publish
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/station-datasets/[id]/rollback/route.ts`
- Description: API route for admin/station-datasets/[id]/rollback
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/station-datasets/[id]/route.ts`
- Description: API route for admin/station-datasets/[id]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/station-datasets/[id]/validate/route.ts`
- Description: API route for admin/station-datasets/[id]/validate
- Exports/defines: POST, runtime
- Imported by: none found

#### `src/app/api/admin/station-datasets/from-file/route.ts`
- Description: API route for admin/station-datasets/from-file
- Exports/defines: POST, runtime
- Imported by: none found

#### `src/app/api/admin/station-datasets/history/route.ts`
- Description: API route for admin/station-datasets/history
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/station-datasets/upload/route.ts`
- Description: API route for admin/station-datasets/upload
- Exports/defines: POST, runtime
- Imported by: none found

#### `src/app/api/admin/station-files/route.ts`
- Description: API route for admin/station-files
- Exports/defines: GET, DELETE
- Imported by: none found

#### `src/app/api/admin/station-operations/audit/route.ts`
- Description: API route for admin/station-operations/audit
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/station-operations/summary/route.ts`
- Description: API route for admin/station-operations/summary
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/stations/matrix/route.ts`
- Description: API route for admin/stations/matrix
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/stations/route.ts`
- Description: API route for admin/stations
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/stats/route.ts`
- Description: API route for admin/stats
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/transactions/[id]/route.ts`
- Description: API route for admin/transactions/[id]
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/transactions/export/route.ts`
- Description: API route for admin/transactions/export
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/transactions/refund/reconcile/route.ts`
- Description: API route for admin/transactions/refund/reconcile
- Exports/defines: POST, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/transactions/refund/route.ts`
- Description: API route for admin/transactions/refund
- Exports/defines: POST, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/transactions/reports/route.ts`
- Description: API route for admin/transactions/reports
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/transactions/route.ts`
- Description: API route for admin/transactions
- Exports/defines: parseFilters, buildTxQuery, GET, dynamic, runtime, TxFilters
- Imported by: none found

#### `src/app/api/admin/transactions/timeseries/route.ts`
- Description: API route for admin/transactions/timeseries
- Exports/defines: GET, dynamic, runtime
- Imported by: none found

#### `src/app/api/admin/trips/[id]/assign/route.ts`
- Description: API route for admin/trips/[id]/assign
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/admin/trips/[id]/available-drivers/route.ts`
- Description: API route for admin/trips/[id]/available-drivers
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/trips/[id]/route.ts`
- Description: API route for admin/trips/[id]
- Exports/defines: GET, DELETE
- Imported by: none found

#### `src/app/api/admin/trips/route.ts`
- Description: API route for admin/trips
- Exports/defines: GET, DELETE
- Imported by: none found

#### `src/app/api/admin/users/[id]/referral-unlimited/route.ts`
- Description: API route for admin/users/[id]/referral-unlimited
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/admin/users/[id]/reset-password/route.ts`
- Description: API route for admin/users/[id]/reset-password
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/users/[id]/route.ts`
- Description: API route for admin/users/[id]
- Exports/defines: GET, PATCH, DELETE
- Imported by: none found

#### `src/app/api/admin/users/route.ts`
- Description: API route for admin/users
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/users/search/route.ts`
- Description: API route for admin/users/search
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/users/unlimited/route.ts`
- Description: API route for admin/users/unlimited
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/admin/vehicles/[key]/route.ts`
- Description: API route for admin/vehicles/[key]
- Exports/defines: PATCH, DELETE
- Imported by: none found

#### `src/app/api/admin/vehicles/route.ts`
- Description: API route for admin/vehicles
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/admin/waiting-list/[id]/route.ts`
- Description: API route for admin/waiting-list/[id]
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/admin/waiting-list/count/route.ts`
- Description: API route for admin/waiting-list/count
- Exports/defines: GET, dynamic
- Imported by: none found

#### `src/app/api/admin/waiting-list/route.ts`
- Description: API route for admin/waiting-list
- Exports/defines: GET, dynamic
- Imported by: none found

#### `src/app/api/admin/withdrawals/[id]/approve/route.ts`
- Description: API route for admin/withdrawals/[id]/approve
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/withdrawals/[id]/reject/route.ts`
- Description: API route for admin/withdrawals/[id]/reject
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/admin/withdrawals/route.ts`
- Description: API route for admin/withdrawals
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/auth/addresses/[id]/route.ts`
- Description: API route for auth/addresses/[id]
- Exports/defines: PATCH, DELETE
- Imported by: none found

#### `src/app/api/auth/addresses/route.ts`
- Description: API route for auth/addresses
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/auth/change-password/route.ts`
- Description: API route for auth/change-password
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/forgot-password/route.ts`
- Description: API route for auth/forgot-password
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/login/route.ts`
- Description: API route for auth/login
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/logout/route.ts`
- Description: API route for auth/logout
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/me/route.ts`
- Description: API route for auth/me
- Exports/defines: GET, PATCH
- Imported by: none found

#### `src/app/api/auth/otp/request/route.ts`
- Description: API route for auth/otp/request
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/otp/verify/route.ts`
- Description: API route for auth/otp/verify
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/register/route.ts`
- Description: API route for auth/register
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/security-question/route.ts`
- Description: API route for auth/security-question
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/security-question/setup/route.ts`
- Description: API route for auth/security-question/setup
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/signUpDriver/route.ts`
- Description: API route for auth/signUpDriver
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/auth/verification-config/route.ts`
- Description: API route for auth/verification-config
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/bookings/[id]/status/route.ts`
- Description: API route for bookings/[id]/status
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/contact/route.ts`
- Description: API route for contact
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/directions/route.ts`
- Description: API route for directions
- Exports/defines: isMatrixProvider, fetchOsrmDirectionsTable, fetchOpenRouteServiceMatrix, fetchValhallaMatrix, fetchGraphHopperMatrix, fetchTravelTimeMatrix, fetchDirectionsMatrix, fetchDirections, GET, MatrixProvider, ValhallaDateTimeType, TravelTimeTransportation
- Imported by: src/app/api/admin/getMatchData/route.ts; src/app/api/admin/getPrivateRideRequests/route.ts; src/app/api/admin/stations/matrix/route.ts

#### `src/app/api/driver/availability/[id]/route.ts`
- Description: API route for driver/availability/[id]
- Exports/defines: DELETE
- Imported by: none found

#### `src/app/api/driver/availability/route.ts`
- Description: API route for driver/availability
- Exports/defines: GET, DELETE, PUT
- Imported by: none found

#### `src/app/api/driver/rides/[id]/accept/route.ts`
- Description: API route for driver/rides/[id]/accept
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/driver/rides/[id]/reject/route.ts`
- Description: API route for driver/rides/[id]/reject
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/driver/submit-review/route.ts`
- Description: API route for driver/submit-review
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/driver/trips/[id]/complete/route.ts`
- Description: API route for driver/trips/[id]/complete
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/driver/trips/[id]/start/route.ts`
- Description: API route for driver/trips/[id]/start
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/driver/trips/route.ts`
- Description: API route for driver/trips
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/geocode/reverse/route.ts`
- Description: API route for geocode/reverse
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/logs/[logId]/route.ts`
- Description: API route for logs/[logId]
- Exports/defines: GET, DELETE
- Imported by: none found

#### `src/app/api/logs/driver/[driverId]/route.ts`
- Description: API route for logs/driver/[driverId]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/logs/route.ts`
- Description: API route for logs
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/logs/trip/[tripId]/route.ts`
- Description: API route for logs/trip/[tripId]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/logs/user/[userId]/route.ts`
- Description: API route for logs/user/[userId]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/notifications/[id]/read/route.ts`
- Description: API route for notifications/[id]/read
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/notifications/[id]/route.ts`
- Description: API route for notifications/[id]
- Exports/defines: PATCH
- Imported by: none found

#### `src/app/api/notifications/read-all/route.ts`
- Description: API route for notifications/read-all
- Exports/defines: POST, PATCH
- Imported by: none found

#### `src/app/api/notifications/route.ts`
- Description: API route for notifications
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/notifications/unread/route.ts`
- Description: API route for notifications/unread
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/ors/route.ts`
- Description: API route for ors
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/payments/[id]/route.ts`
- Description: API route for payments/[id]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/payments/session/route.ts`
- Description: API route for payments/session
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/payments/verify/route.ts`
- Description: API route for payments/verify
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/payments/wallet/route.ts`
- Description: API route for payments/wallet
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/payments/webhook/route.ts`
- Description: API route for payments/webhook
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/places/autocomplete/route.ts`
- Description: API route for places/autocomplete
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/places/details/route.ts`
- Description: API route for places/details
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/promo-codes/validate/route.ts`
- Description: API route for promo-codes/validate
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/push/subscriptions/route.ts`
- Description: API route for push/subscriptions
- Exports/defines: GET, POST, DELETE
- Imported by: none found

#### `src/app/api/push/vapid-public-key/route.ts`
- Description: API route for push/vapid-public-key
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/referral/my-code/route.ts`
- Description: API route for referral/my-code
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/requests/[id]/cancel/route.ts`
- Description: API route for requests/[id]/cancel
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/requests/[id]/route.ts`
- Description: API route for requests/[id]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/requests/route.ts`
- Description: API route for requests
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/ride/[id]/passengers/[tripId]/route.ts`
- Description: API route for ride/[id]/passengers/[tripId]
- Exports/defines: PATCH, DELETE
- Imported by: none found

#### `src/app/api/ride/[id]/route.ts`
- Description: API route for ride/[id]
- Exports/defines: GET, PATCH, DELETE
- Imported by: none found

#### `src/app/api/ride/route.ts`
- Description: API route for ride
- Exports/defines: POST, GET
- Imported by: none found

#### `src/app/api/stations/[id]/route.ts`
- Description: API route for stations/[id]
- Exports/defines: PATCH, DELETE
- Imported by: none found

#### `src/app/api/stations/import/route.ts`
- Description: API route for stations/import
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/stations/route.ts`
- Description: API route for stations
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/trips/[id]/cancel/route.ts`
- Description: API route for trips/[id]/cancel
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/trips/[id]/chat/route.ts`
- Description: API route for trips/[id]/chat
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/trips/[id]/rating/route.ts`
- Description: API route for trips/[id]/rating
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/trips/[id]/route.ts`
- Description: API route for trips/[id]
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/trips/expire/route.ts`
- Description: API route for trips/expire
- Exports/defines: POST, GET
- Imported by: none found

#### `src/app/api/trips/route.ts`
- Description: API route for trips
- Exports/defines: GET, POST
- Imported by: none found

#### `src/app/api/trips/spacing/route.ts`
- Description: API route for trips/spacing
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/upload/[filename]/route.ts`
- Description: API route for upload/[filename]
- Exports/defines: GET, runtime
- Imported by: none found

#### `src/app/api/upload/route.ts`
- Description: API route for upload
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/vehicles/[key]/route.ts`
- Description: API route for vehicles/[key]
- Exports/defines: GET, PATCH, DELETE
- Imported by: none found

#### `src/app/api/vehicles/route.ts`
- Description: API route for vehicles
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/wallet/payout-method/route.ts`
- Description: API route for wallet/payout-method
- Exports/defines: GET, PATCH
- Imported by: none found

#### `src/app/api/wallet/reconcile/route.ts`
- Description: API route for wallet/reconcile
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/wallet/route.ts`
- Description: API route for wallet
- Exports/defines: GET
- Imported by: none found

#### `src/app/api/wallet/topup/route.ts`
- Description: API route for wallet/topup
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/wallet/topup/verify/route.ts`
- Description: API route for wallet/topup/verify
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/wallet/withdraw/[id]/cancel/route.ts`
- Description: API route for wallet/withdraw/[id]/cancel
- Exports/defines: POST
- Imported by: none found

#### `src/app/api/wallet/withdraw/route.ts`
- Description: API route for wallet/withdraw
- Exports/defines: GET, POST
- Imported by: none found


### Components

#### `src/components/admin/AdminActivityFeed.tsx`
- Description: UI component for admin
- Exports/defines: default, AdminActivityFeed, function
- Imported by: src/app/admin/alerts/page.tsx

#### `src/components/admin/AdminAvailabilityTable.tsx`
- Description: UI component for admin
- Exports/defines: default, AdminAvailabilityTable, function
- Imported by: src/app/admin/availability/page.tsx

#### `src/components/admin/AdminDateRangeCalendar.tsx`
- Description: UI component for admin
- Exports/defines: default, AdminDateRangeCalendar, function
- Imported by: src/app/admin/rides/page.tsx; src/app/admin/trips/page.tsx

#### `src/components/admin/AdminLogoutButton.tsx`
- Description: UI component for admin
- Exports/defines: default, AdminLogoutButton, function
- Imported by: src/components/admin/layout/AdminShell.tsx

#### `src/components/admin/AdminReferralCampaigns.tsx`
- Description: UI component for admin
- Exports/defines: default, AdminReferralCampaigns, function
- Imported by: src/components/admin/ReferralSettingsForm.tsx

#### `src/components/admin/AdminTripMap.tsx`
- Description: UI component for admin
- Exports/defines: default, AdminTripMap, function, TripMapPoint
- Imported by: src/app/admin/rides/page.tsx; src/app/admin/trips/page.tsx; src/components/admin/StationManagement.tsx; src/components/admin/StationsClient.tsx

#### `src/components/admin/CancellationSettingsForm.tsx`
- Description: UI component for admin
- Exports/defines: default, CancellationSettingsForm, function
- Imported by: src/app/admin/settings/page.tsx

#### `src/components/admin/DashboardCharts.tsx`
- Description: UI component for admin
- Exports/defines: default, DashboardCharts, function
- Imported by: src/app/admin/dashboard/page.tsx

#### `src/components/admin/MapSettingsManager.tsx`
- Description: UI component for admin
- Exports/defines: default, MapSettingsManager, function
- Imported by: src/app/admin/maps/page.tsx

#### `src/components/admin/MatchRideForm.tsx`
- Description: UI component for admin
- Exports/defines: default, MatchRideForm, function
- Imported by: src/app/admin/dashboard/page.tsx

#### `src/components/admin/NotificationCenter.tsx`
- Description: UI component for admin
- Exports/defines: default, NotificationCenter, function
- Imported by: src/app/admin/notifications/page.tsx

#### `src/components/admin/OperationConsole.tsx`
- Description: UI component for admin
- Exports/defines: default, OperationConsole, function
- Imported by: src/app/[region]/admin/operation/page.tsx

#### `src/components/admin/PromoCodesManager.tsx`
- Description: UI component for admin
- Exports/defines: default, PromoCodesManager, function
- Imported by: src/app/admin/promo-codes/page.tsx

#### `src/components/admin/ReferralAuditHistory.tsx`
- Description: UI component for admin
- Exports/defines: default, ReferralAuditHistory, function
- Imported by: src/app/admin/referral-settings/page.tsx

#### `src/components/admin/ReferralSettingsForm.tsx`
- Description: UI component for admin
- Exports/defines: default, ReferralSettingsForm, function, ReferralSettingsValues
- Imported by: src/app/admin/referral-settings/page.tsx

#### `src/components/admin/ReferralUserOverrides.tsx`
- Description: UI component for admin
- Exports/defines: default, ReferralUserOverrides, function
- Imported by: none found

#### `src/components/admin/RefundRequestsClient.tsx`
- Description: UI component for admin
- Exports/defines: default, RefundRequestsClient, function
- Imported by: none found

#### `src/components/admin/SmsBalanceCard.tsx`
- Description: UI component for admin
- Exports/defines: default, SmsBalanceCard, function
- Imported by: src/app/admin/dashboard/page.tsx

#### `src/components/admin/StationManagement.tsx`
- Description: UI component for admin
- Exports/defines: default, StationManagement, function
- Imported by: src/app/[region]/admin/stations/page.tsx

#### `src/components/admin/StationOperations.tsx`
- Description: UI component for admin
- Exports/defines: default, StationOperations, function
- Imported by: src/app/[region]/admin/operation/page.tsx

#### `src/components/admin/StationsClient.tsx`
- Description: UI component for admin
- Exports/defines: default, StationsClient, function, AdminStationRow
- Imported by: none found

#### `src/components/admin/UnlimitedReferralCards.tsx`
- Description: UI component for admin
- Exports/defines: default, UnlimitedReferralCards, function
- Imported by: src/app/admin/referral-settings/page.tsx; src/app/admin/users/page.tsx

#### `src/components/admin/UserManagementClient.tsx`
- Description: UI component for admin
- Exports/defines: default, UserManagementClient, function
- Imported by: src/app/admin/users/page.tsx

#### `src/components/admin/VehiclesManager.tsx`
- Description: UI component for admin
- Exports/defines: default, VehiclesManager, function
- Imported by: src/app/admin/vehicles/page.tsx

#### `src/components/admin/WaitingListClient.tsx`
- Description: UI component for admin
- Exports/defines: default, WaitingListClient, function
- Imported by: src/app/admin/waiting-list/page.tsx

#### `src/components/admin/WithdrawalQueueClient.tsx`
- Description: UI component for admin
- Exports/defines: default, WithdrawalQueueClient, function
- Imported by: src/app/admin/withdrawals/page.tsx

#### `src/components/admin/layout/AdminActivityBell.tsx`
- Description: UI component for admin/layout
- Exports/defines: default, AdminActivityBell, function
- Imported by: src/components/admin/layout/AdminShell.tsx

#### `src/components/admin/layout/AdminShell.tsx`
- Description: UI component for admin/layout
- Exports/defines: default, AdminShell, function, AdminTopbarActions
- Imported by: src/app/[region]/admin/layout.tsx; src/app/admin/dashboard/page.tsx; src/app/admin/layout.tsx; src/app/admin/notifications/page.tsx; src/components/admin/transactions/TransactionsClient.tsx

#### `src/components/admin/layout/index.tsx`
- Description: UI component for admin/layout
- Exports/defines: AdminButton, AdminPageContainer, AdminPageHeader, AdminCard, AdminEmptyState, AdminLoadingState, AdminErrorState, AdminStatusBadge, AdminTable, AdminPagination, AdminFormLayout, AdminFormField
- Imported by: src/app/[region]/admin/operation/page.tsx; src/app/[region]/admin/stations/page.tsx; src/app/admin/availability/page.tsx; src/app/admin/dashboard/page.tsx; src/app/admin/maps/page.tsx; src/app/admin/notifications/page.tsx; src/app/admin/promo-codes/page.tsx; src/app/admin/referral-settings/page.tsx; src/app/admin/rides/page.tsx; src/app/admin/settings/page.tsx; src/app/admin/trips/page.tsx; src/app/admin/users/page.tsx; src/app/admin/vehicles/page.tsx; src/app/admin/waiting-list/page.tsx; src/app/admin/withdrawals/page.tsx; src/components/admin/AdminActivityFeed.tsx; src/components/admin/AdminAvailabilityTable.tsx; src/components/admin/AdminLogoutButton.tsx; src/components/admin/CancellationSettingsForm.tsx; src/components/admin/DashboardCharts.tsx; src/components/admin/OperationConsole.tsx; src/components/admin/ReferralSettingsForm.tsx; src/components/admin/SmsBalanceCard.tsx; src/components/admin/StationManagement.tsx; src/components/admin/StationOperations.tsx; src/components/admin/UserManagementClient.tsx; src/components/admin/WaitingListClient.tsx; src/components/admin/WithdrawalQueueClient.tsx; src/components/admin/transactions/TransactionDetailClient.tsx; src/components/admin/transactions/TransactionsChart.tsx; src/components/admin/transactions/TransactionsClient.tsx

#### `src/components/admin/transactions/TransactionDetailClient.tsx`
- Description: UI component for admin/transactions
- Exports/defines: default, TransactionDetailClient, function
- Imported by: src/app/admin/transactions/[id]/page.tsx

#### `src/components/admin/transactions/TransactionsChart.tsx`
- Description: UI component for admin/transactions
- Exports/defines: default, TransactionsChart, function
- Imported by: src/components/admin/transactions/TransactionsClient.tsx

#### `src/components/admin/transactions/TransactionsClient.tsx`
- Description: UI component for admin/transactions
- Exports/defines: default, TransactionsClient, function
- Imported by: src/app/admin/transactions/page.tsx

#### `src/components/auth/DriverRegisterForm.tsx`
- Description: UI component for auth
- Exports/defines: default, DriverRegisterForm, function
- Imported by: src/app/login/page.tsx

#### `src/components/availability/AvailabilityMap.tsx`
- Description: UI component for availability
- Exports/defines: default, AvailabilityMap, function
- Imported by: none found

#### `src/components/availability/AvailabilityMapOsm.tsx`
- Description: UI component for availability
- Exports/defines: default, AvailabilityMapOsm, function
- Imported by: none found

#### `src/components/contact/ContactForm.tsx`
- Description: UI component for contact
- Exports/defines: default, ContactForm, function
- Imported by: src/app/contact/page.tsx

#### `src/components/contact/ContactHeader.tsx`
- Description: UI component for contact
- Exports/defines: default, ContactHeader, function
- Imported by: src/app/contact/page.tsx

#### `src/components/create/CreateClient.tsx`
- Description: UI component for create
- Exports/defines: default, CreateClient, function
- Imported by: src/app/create/page.tsx

#### `src/components/create/CreateMap.tsx`
- Description: UI component for create
- Exports/defines: default, CreateMap, function
- Imported by: none found

#### `src/components/create/CreateMapGoogle.tsx`
- Description: UI component for create
- Exports/defines: default, CreateMapGoogle, function
- Imported by: none found

#### `src/components/create/CreateMapOsm.tsx`
- Description: UI component for create
- Exports/defines: default, CreateMapOsm, function
- Imported by: none found

#### `src/components/create/DatePicker.tsx`
- Description: UI component for create
- Exports/defines: default, DatePicker, function
- Imported by: src/components/create/CreateClient.tsx

#### `src/components/create/TripCycle.tsx`
- Description: UI component for create
- Exports/defines: default, TripCycle, function, PassengerDetail, StopPoint, RouteLeg, TripData
- Imported by: src/components/create/CreateClient.tsx; src/components/create/CreateMap.tsx; src/components/create/CreateMapGoogle.tsx; src/components/create/CreateMapOsm.tsx

#### `src/components/faq/FAQContent.tsx`
- Description: UI component for faq
- Exports/defines: default, FAQContent, function
- Imported by: src/app/faq/page.tsx

#### `src/components/icons/EmptyStateIcons.tsx`
- Description: UI component for icons
- Exports/defines: PassengerEmptyIcon, DriverEmptyIcon
- Imported by: src/app/my-trips/page.tsx

#### `src/components/landing/AddressInput.tsx`
- Description: UI component for landing
- Exports/defines: default, AddressInput, function
- Imported by: src/components/admin/MapSettingsManager.tsx; src/components/create/TripCycle.tsx; src/components/landing/Hero.tsx

#### `src/components/landing/CTA.tsx`
- Description: UI component for landing
- Exports/defines: default, CTA, function
- Imported by: src/app/page.tsx

#### `src/components/landing/Hero.tsx`
- Description: UI component for landing
- Exports/defines: default, Hero, function
- Imported by: src/app/page.tsx

#### `src/components/landing/HowItWorks.tsx`
- Description: UI component for landing
- Exports/defines: default, HowItWorks, function
- Imported by: src/app/page.tsx

#### `src/components/landing/VehicleTypes.tsx`
- Description: UI component for landing
- Exports/defines: default, VehicleTypes, function
- Imported by: none found

#### `src/components/landing/WhyCommuter.tsx`
- Description: UI component for landing
- Exports/defines: default, WhyCommuter, function
- Imported by: src/app/page.tsx

#### `src/components/layout/AppHeader.tsx`
- Description: UI component for layout
- Exports/defines: default, AppHeader, function
- Imported by: src/app/availability/AvailabilityClient.tsx; src/app/contact/page.tsx; src/app/faq/page.tsx; src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/app/page.tsx; src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx; src/app/profile/verification/DriverVerificationClient.tsx; src/app/ride-requests/page.tsx; src/app/terms/page.tsx; src/app/user/notifications/page.tsx; src/app/wallet/page.tsx; src/components/create/CreateClient.tsx; src/components/trips/DriverRideInteractiveClient.tsx

#### `src/components/layout/BottomNav.tsx`
- Description: UI component for layout
- Exports/defines: default, BottomNav, function
- Imported by: none found

#### `src/components/layout/DriverBottomNav.tsx`
- Description: UI component for layout
- Exports/defines: default, DriverBottomNav, function
- Imported by: none found

#### `src/components/layout/Footer.tsx`
- Description: UI component for layout
- Exports/defines: default, Footer, function
- Imported by: src/app/contact/page.tsx; src/app/faq/page.tsx; src/app/page.tsx

#### `src/components/layout/Header.tsx`
- Description: UI component for layout
- Exports/defines: default, Header, function
- Imported by: none found

#### `src/components/layout/LanguageToggle.tsx`
- Description: UI component for layout
- Exports/defines: default, LanguageToggle, function
- Imported by: src/app/admin/dashboard/page.tsx; src/app/admin/notifications/page.tsx; src/components/layout/UserNavbar.tsx

#### `src/components/layout/NotificationCenter.tsx`
- Description: UI component for layout
- Exports/defines: default, NotificationCenter, function
- Imported by: src/components/layout/AppHeader.tsx

#### `src/components/layout/UserNavbar.tsx`
- Description: UI component for layout
- Exports/defines: default, UserNavbar, function
- Imported by: none found

#### `src/components/map/GoogleMapCanvas.tsx`
- Description: UI component for map
- Exports/defines: default, GoogleMapCanvas, function
- Imported by: src/components/admin/MapSettingsManager.tsx; src/components/create/CreateMapGoogle.tsx

#### `src/components/map/LocationPickerMap.tsx`
- Description: UI component for map
- Exports/defines: default, LocationPickerMap, function
- Imported by: src/components/admin/AdminAvailabilityTable.tsx

#### `src/components/map/LocationPickerMapOsm.tsx`
- Description: UI component for map
- Exports/defines: default, LocationPickerMapOsm, function, SavedAddress
- Imported by: src/app/availability/AvailabilityClient.tsx

#### `src/components/map/OsmMapCanvas.tsx`
- Description: UI component for map
- Exports/defines: default, OsmMapCanvas, function, OsmPoint
- Imported by: src/components/admin/MapSettingsManager.tsx; src/components/availability/AvailabilityMapOsm.tsx; src/components/create/CreateMapOsm.tsx; src/components/map/LocationPickerMapOsm.tsx; src/components/map/PickupMapInnerOsm.tsx; src/components/shared/RouteMapOsm.tsx

#### `src/components/map/PickupMap.tsx`
- Description: UI component for map
- Exports/defines: default, PickupMap, function
- Imported by: none found

#### `src/components/map/PickupMapInner.tsx`
- Description: UI component for map
- Exports/defines: default, PickupMapInner, function
- Imported by: none found

#### `src/components/map/PickupMapInnerOsm.tsx`
- Description: UI component for map
- Exports/defines: default, PickupMapInnerOsm, function
- Imported by: none found

#### `src/components/map/leafletLayers.ts`
- Description: UI component for map
- Exports/defines: svgIcon, fitPoints, LatLng
- Imported by: src/components/availability/AvailabilityMapOsm.tsx; src/components/create/CreateMapOsm.tsx; src/components/map/LocationPickerMapOsm.tsx; src/components/map/PickupMapInnerOsm.tsx; src/components/shared/RouteMapOsm.tsx

#### `src/components/map/mapIcons.ts`
- Description: UI component for map
- Exports/defines: pickupIcon, destinationIcon
- Imported by: none found

#### `src/components/map/useRouteOSRM.ts`
- Description: UI component for map
- Exports/defines: useRouteOSRM
- Imported by: src/components/map/PickupMapInner.tsx; src/components/map/PickupMapInnerOsm.tsx

#### `src/components/shared/AgeGateInput.tsx`
- Description: UI component for shared
- Exports/defines: default, AgeGateInput, function
- Imported by: none found

#### `src/components/shared/AppSelect.tsx`
- Description: UI component for shared
- Exports/defines: default, AppSelect, function, AppSelectOption
- Imported by: src/components/create/TripCycle.tsx

#### `src/components/shared/BottomSheet.tsx`
- Description: UI component for shared
- Exports/defines: default, BottomSheet, function
- Imported by: src/components/shared/SavedAddressesSection.tsx

#### `src/components/shared/ChangePasswordSection.tsx`
- Description: UI component for shared
- Exports/defines: default, ChangePasswordSection, function
- Imported by: src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx

#### `src/components/shared/CodeConfirmInput.tsx`
- Description: UI component for shared
- Exports/defines: default, CodeConfirmInput, function
- Imported by: none found

#### `src/components/shared/ContinueCheckoutButton.tsx`
- Description: UI component for shared
- Exports/defines: default, ContinueCheckoutButton, function
- Imported by: src/app/my-trips/[id]/page.tsx; src/app/my-trips/page.tsx

#### `src/components/shared/DateRangeCalendar.tsx`
- Description: UI component for shared
- Exports/defines: default, DateRangeCalendar, function
- Imported by: src/app/my-trips/page.tsx

#### `src/components/shared/EmptyState.tsx`
- Description: UI component for shared
- Exports/defines: default, EmptyState, function
- Imported by: src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/app/ride-requests/page.tsx; src/app/user/notifications/page.tsx

#### `src/components/shared/FilterBar.tsx`
- Description: UI component for shared
- Exports/defines: default, FilterBar, function, FilterDef
- Imported by: none found

#### `src/components/shared/InfoTooltip.tsx`
- Description: UI component for shared
- Exports/defines: default, InfoTooltip, function
- Imported by: none found

#### `src/components/shared/LogoutConfirmModal.tsx`
- Description: UI component for shared
- Exports/defines: default, LogoutConfirmModal, function
- Imported by: src/components/layout/AppHeader.tsx; src/components/layout/UserNavbar.tsx

#### `src/components/shared/PageHeader.tsx`
- Description: UI component for shared
- Exports/defines: default, PageHeader, function
- Imported by: none found

#### `src/components/shared/Pagination.tsx`
- Description: UI component for shared
- Exports/defines: default, Pagination, function
- Imported by: src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx

#### `src/components/shared/PasswordInput.tsx`
- Description: UI component for shared
- Exports/defines: default, PasswordInput, function
- Imported by: src/app/admin/login/page.tsx; src/app/login/page.tsx; src/components/auth/DriverRegisterForm.tsx; src/components/shared/ChangePasswordSection.tsx

#### `src/components/shared/PasswordStrengthMeter.tsx`
- Description: UI component for shared
- Exports/defines: default, PasswordStrengthMeter, function
- Imported by: src/app/admin/login/page.tsx; src/app/admin/signup/page.tsx; src/app/forgot-password/page.tsx; src/app/login/page.tsx; src/components/auth/DriverRegisterForm.tsx; src/components/shared/ChangePasswordSection.tsx

#### `src/components/shared/PhoneVerificationCard.tsx`
- Description: UI component for shared
- Exports/defines: default, PhoneVerificationCard, function
- Imported by: src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx

#### `src/components/shared/ReferralCard.tsx`
- Description: UI component for shared
- Exports/defines: default, ReferralCard, function
- Imported by: src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx

#### `src/components/shared/RouteMap.tsx`
- Description: UI component for shared
- Exports/defines: default, RouteMap, function
- Imported by: src/components/trips/DriverRideInteractiveClient.tsx

#### `src/components/shared/RouteMapOsm.tsx`
- Description: UI component for shared
- Exports/defines: default, RouteMapOsm, function
- Imported by: none found

#### `src/components/shared/RouteMapOsmLoader.tsx`
- Description: UI component for shared
- Exports/defines: default, RouteMapOsm
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/components/shared/SaveAddressButton.tsx`
- Description: UI component for shared
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `src/components/shared/SavedAddressesSection.tsx`
- Description: UI component for shared
- Exports/defines: default, SavedAddressesSection, function
- Imported by: src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx

#### `src/components/shared/Section.tsx`
- Description: UI component for shared
- Exports/defines: default, Section, function
- Imported by: src/app/profile/DriverProfileClient.tsx

#### `src/components/shared/SecurityQuestionSetupCard.tsx`
- Description: UI component for shared
- Exports/defines: default, SecurityQuestionSetupCard, function
- Imported by: src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx

#### `src/components/shared/StatusGroupFilter.tsx`
- Description: UI component for shared
- Exports/defines: default, StatusGroupFilter, function
- Imported by: src/app/my-trips/page.tsx

#### `src/components/shared/StatusPill.tsx`
- Description: UI component for shared
- Exports/defines: default, StatusPill, function
- Imported by: none found

#### `src/components/shared/StickySidebar.tsx`
- Description: UI component for shared
- Exports/defines: default, StickySidebar, function
- Imported by: none found

#### `src/components/shared/TripChat.tsx`
- Description: UI component for shared
- Exports/defines: default, TripChat, function
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/components/shared/TripChatButton.tsx`
- Description: UI component for shared
- Exports/defines: default, TripChatButton, function
- Imported by: none found

#### `src/components/shared/WaitTimer.tsx`
- Description: UI component for shared
- Exports/defines: default, WaitTimer, function
- Imported by: none found

#### `src/components/trips/CancelTripModal.tsx`
- Description: UI component for trips
- Exports/defines: default, CancelTripModal, function
- Imported by: src/app/my-trips/[id]/page.tsx; src/app/my-trips/page.tsx

#### `src/components/trips/DriverCard.tsx`
- Description: UI component for trips
- Exports/defines: default, DriverCard, function
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/components/trips/DriverRideInteractiveClient.tsx`
- Description: UI component for trips
- Exports/defines: default, DriverRideInteractiveClient, function
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/components/trips/MatchedTripCountdown.tsx`
- Description: UI component for trips
- Exports/defines: default, MatchedTripCountdown, function
- Imported by: src/app/my-trips/[id]/page.tsx; src/app/my-trips/page.tsx

#### `src/components/trips/NextTripCard.tsx`
- Description: UI component for trips
- Exports/defines: default, NextTripCard, function
- Imported by: src/app/my-trips/page.tsx

#### `src/components/trips/NextTripCountdown.tsx`
- Description: UI component for trips
- Exports/defines: default, NextTripCountdown, function
- Imported by: src/components/trips/NextTripCard.tsx

#### `src/components/trips/PrivateRideDetails.tsx`
- Description: UI component for trips
- Exports/defines: default, PrivateRideDetails, function
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/components/trips/RateTripModal.tsx`
- Description: UI component for trips
- Exports/defines: default, RateTripModal, function
- Imported by: src/app/my-trips/[id]/page.tsx; src/app/my-trips/page.tsx

#### `src/components/trips/RequestGroupCancellationControls.tsx`
- Description: UI component for trips
- Exports/defines: default, RequestGroupCancellationControls, function
- Imported by: src/app/my-trips/page.tsx

#### `src/components/trips/RideOfferCard.tsx`
- Description: UI component for trips
- Exports/defines: default, RideOfferCard, function
- Imported by: src/app/ride-requests/page.tsx

#### `src/components/trips/SharedRideDetails.tsx`
- Description: UI component for trips
- Exports/defines: default, SharedRideDetails, function
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/components/trips/TripDetailParts.tsx`
- Description: UI component for trips
- Exports/defines: RideDetailRow, TripStatBlock
- Imported by: src/components/trips/PrivateRideDetails.tsx; src/components/trips/SharedRideDetails.tsx

#### `src/components/trips/TripHistoryControls.tsx`
- Description: UI component for trips
- Exports/defines: default, TripHistoryControls, function
- Imported by: src/app/my-trips/history/page.tsx

#### `src/components/trips/TripHistoryFilters.tsx`
- Description: UI component for trips
- Exports/defines: default, TripHistoryFilters, function
- Imported by: src/app/my-trips/history/page.tsx

#### `src/components/trips/TripTabs.tsx`
- Description: UI component for trips
- Exports/defines: default, TripTabs, function
- Imported by: src/app/my-trips/page.tsx

#### `src/components/trips/VehicleSeatMap.tsx`
- Description: UI component for trips
- Exports/defines: default, VehicleSeatMap, function, getVehicleSeatGrid, getVehicleChassisStyle, SeatGridCell
- Imported by: src/app/my-trips/[id]/page.tsx; src/components/trips/DriverRideInteractiveClient.tsx

#### `src/components/wallet/WalletClient.tsx`
- Description: UI component for wallet
- Exports/defines: default, WalletClient, function
- Imported by: src/app/wallet/page.tsx


### Lib

#### `src/lib/MapContext.tsx`
- Description: Library module for 
- Exports/defines: MapProvider, useMap
- Imported by: none found

#### `src/lib/MapSearchContext.tsx`
- Description: Library module for 
- Exports/defines: MapSearchProvider, useMapSearchProvider
- Imported by: src/components/admin/MapSettingsManager.tsx; src/components/create/CreateClient.tsx; src/components/landing/AddressInput.tsx

#### `src/lib/admin/vehicleInput.ts`
- Description: Library module for admin
- Exports/defines: cleanVehicle
- Imported by: src/app/api/admin/vehicles/[key]/route.ts; src/app/api/admin/vehicles/route.ts

#### `src/lib/admin/waitingList.ts`
- Description: Library module for admin
- Exports/defines: getSharedRideWaitingListEnabled, shouldCreateWaitingListRequest, hasPastTrip, countWaitingListRows, paginateWaitingListRows, validateWaitingListAction, buildWaitingListTransitionFilter, buildWaitingListTripTransitionFilter, buildWaitingListReviewUpdate, buildWaitingListTripCancellationUpdate, groupPromoUsageCounts, buildWaitingListCreatedAdminNotifications
- Imported by: src/app/api/admin/settings/waiting-list/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/admin/waiting-list/count/route.ts; src/app/api/admin/waiting-list/route.ts; src/app/api/payments/session/route.ts; src/app/api/trips/route.ts; src/app/api/vehicles/route.ts; src/components/create/CreateClient.tsx; src/lib/notifications/adminActivity.ts; src/lib/services/requests.ts; src/lib/standaloneTripExpiry.ts

#### `src/lib/admin/waitingListUi.ts`
- Description: Library module for admin
- Exports/defines: formatWaitingListAge, waitingListErrorKey, waitingListErrorMessageKey, formatAdminBadgeCount, WaitingListErrorKey
- Imported by: src/components/admin/WaitingListClient.tsx

#### `src/lib/api/chat.ts`
- Description: Library module for api
- Exports/defines: getTripMessages, sendMessage, ChatMessage
- Imported by: src/components/shared/TripChat.tsx

#### `src/lib/api/notifications.ts`
- Description: Library module for api
- Exports/defines: getUnreadCount, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, NotificationItem, NotificationListResponse
- Imported by: src/components/layout/BottomNav.tsx; src/components/layout/NotificationCenter.tsx; src/components/layout/UserNavbar.tsx

#### `src/lib/auth/permissions.ts`
- Description: Library module for auth
- Exports/defines: hasPermission, PERMISSIONS, ALL_TRANSACTION_PERMISSIONS, PermissionKey
- Imported by: src/app/admin/transactions/[id]/page.tsx; src/app/admin/transactions/page.tsx; src/app/api/admin/station-datasets/[id]/publish/route.ts; src/app/api/admin/station-datasets/[id]/rollback/route.ts; src/app/api/admin/station-files/route.ts; src/app/api/admin/station-operations/audit/route.ts; src/app/api/admin/station-operations/summary/route.ts; src/app/api/admin/stations/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/export/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/transactions/reports/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/admin/transactions/timeseries/route.ts; src/app/api/stations/[id]/route.ts; src/app/api/stations/route.ts; src/lib/middleware/adminAuth.ts

#### `src/lib/auth/securityQuestion.ts`
- Description: Library module for auth
- Exports/defines: getActiveVerificationMethod, isPlausibleSecurityAnswer, hashSecurityAnswer, verifySecurityAnswer
- Imported by: src/app/api/auth/change-password/route.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/security-question/setup/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/auth/verification-config/route.ts

#### `src/lib/auth/session.ts`
- Description: Library module for auth
- Exports/defines: createSession, getSession, destroySession, UserRole, SessionPayload
- Imported by: src/app/[region]/admin/layout.tsx; src/app/admin/alerts/page.tsx; src/app/admin/availability/page.tsx; src/app/admin/dashboard/page.tsx; src/app/admin/layout.tsx; src/app/admin/notifications/page.tsx; src/app/admin/operation/page.tsx; src/app/admin/promo-codes/page.tsx; src/app/admin/referral-settings/page.tsx; src/app/admin/stations/page.tsx; src/app/admin/transactions/[id]/page.tsx; src/app/admin/transactions/page.tsx; src/app/admin/users/page.tsx; src/app/admin/vehicles/page.tsx; src/app/admin/waiting-list/page.tsx; src/app/admin/withdrawals/page.tsx; src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/drivers/[id]/wallet-settings/route.ts; src/app/api/admin/login/route.ts; src/app/api/admin/maps/route.ts; src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/refund-requests/[id]/reject/route.ts; src/app/api/admin/refund-requests/route.ts; src/app/api/admin/settings/route.ts; src/app/api/admin/signup/route.ts; src/app/api/admin/withdrawals/[id]/approve/route.ts; src/app/api/admin/withdrawals/[id]/reject/route.ts; src/app/api/admin/withdrawals/route.ts; src/app/api/auth/addresses/[id]/route.ts; src/app/api/auth/addresses/route.ts; src/app/api/auth/change-password/route.ts; src/app/api/auth/login/route.ts; src/app/api/auth/logout/route.ts; src/app/api/auth/me/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/otp/verify/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/setup/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/bookings/[id]/status/route.ts; src/app/api/driver/availability/[id]/route.ts; src/app/api/driver/availability/route.ts; src/app/api/driver/rides/[id]/accept/route.ts; src/app/api/driver/rides/[id]/reject/route.ts; src/app/api/driver/submit-review/route.ts; src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/driver/trips/route.ts; src/app/api/logs/[logId]/route.ts; src/app/api/logs/driver/[driverId]/route.ts; src/app/api/logs/route.ts; src/app/api/logs/trip/[tripId]/route.ts; src/app/api/logs/user/[userId]/route.ts; src/app/api/notifications/[id]/read/route.ts; src/app/api/notifications/[id]/route.ts; src/app/api/notifications/read-all/route.ts; src/app/api/notifications/route.ts; src/app/api/notifications/unread/route.ts; src/app/api/payments/[id]/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/verify/route.ts; src/app/api/promo-codes/validate/route.ts; src/app/api/push/subscriptions/route.ts; src/app/api/referral/my-code/route.ts; src/app/api/requests/[id]/cancel/route.ts; src/app/api/requests/[id]/route.ts; src/app/api/requests/route.ts; src/app/api/ride/[id]/route.ts; src/app/api/stations/import/route.ts; src/app/api/stations/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/[id]/chat/route.ts; src/app/api/trips/[id]/rating/route.ts; src/app/api/trips/[id]/route.ts; src/app/api/trips/route.ts; src/app/api/trips/spacing/route.ts; src/app/api/upload/[filename]/route.ts; src/app/api/upload/route.ts; src/app/api/vehicles/[key]/route.ts; src/app/api/wallet/payout-method/route.ts; src/app/api/wallet/reconcile/route.ts; src/app/api/wallet/route.ts; src/app/api/wallet/topup/route.ts; src/app/api/wallet/topup/verify/route.ts; src/app/api/wallet/withdraw/[id]/cancel/route.ts; src/app/api/wallet/withdraw/route.ts; src/app/availability/page.tsx; src/app/checkout/callback/page.tsx; src/app/contact/page.tsx; src/app/create/page.tsx; src/app/faq/page.tsx; src/app/my-requests/[id]/page.tsx; src/app/my-requests/page.tsx; src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/app/page.tsx; src/app/profile/page.tsx; src/app/profile/verification/page.tsx; src/app/ride-requests/page.tsx; src/app/user/notifications/page.tsx; src/app/wallet/page.tsx; src/lib/middleware/adminAuth.ts; src/lib/services/profile.ts

#### `src/lib/auth/smsOtp.ts`
- Description: Library module for auth
- Exports/defines: createSmsOtp, deleteSmsOtp, consumeSmsOtp, SmsOtpPurpose
- Imported by: src/app/api/auth/change-password/route.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/otp/verify/route.ts

#### `src/lib/auth/useVerificationConfig.ts`
- Description: Library module for auth
- Exports/defines: useVerificationConfig
- Imported by: src/app/admin/login/page.tsx; src/app/forgot-password/page.tsx; src/app/login/page.tsx; src/components/auth/DriverRegisterForm.tsx; src/components/shared/ChangePasswordSection.tsx; src/components/shared/PhoneVerificationCard.tsx; src/components/shared/SecurityQuestionSetupCard.tsx

#### `src/lib/auth/validation.ts`
- Description: Library module for auth
- Exports/defines: toNationalDigits, normalizeEgyptPhone, isStrongPassword, PHONE_NATIONAL_LENGTH, PASSWORD_RULES_MESSAGE, PHONE_RULES_MESSAGE
- Imported by: src/app/admin/login/page.tsx; src/app/admin/signup/page.tsx; src/app/api/admin/login/route.ts; src/app/api/admin/signup/route.ts; src/app/api/auth/change-password/route.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/login/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/forgot-password/page.tsx; src/app/login/page.tsx; src/components/auth/DriverRegisterForm.tsx; src/components/shared/ChangePasswordSection.tsx

#### `src/lib/cancellationPolicy.ts`
- Description: Library module for 
- Exports/defines: getAdminSettings, getCutoffDateStr, getNomatchSweepFilter, canModifyAvailability, getCancellationTier, computeWithdrawableBalance, DEFAULT_ADMIN_SETTINGS, CancellationTier, SettingsResult, CancellationTierEvaluation,  getCairoNowParts 
- Imported by: src/app/api/admin/settings/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/admin/waiting-list/route.ts; src/app/api/admin/withdrawals/route.ts; src/app/api/payments/session/route.ts; src/app/api/trips/expire/route.ts; src/app/api/wallet/route.ts; src/lib/passengerCancellationPolicy.ts; src/lib/services/requests.ts; src/lib/services/rideMatching.ts; src/lib/services/rideService.ts; src/lib/wallet/wallet.ts

#### `src/lib/config/cancellationDefaults.ts`
- Description: Library module for config
- Exports/defines: DEFAULT_PASSENGER_CANCELLATION_TIERS, PassengerCancellationTierConfig
- Imported by: src/components/admin/CancellationSettingsForm.tsx; src/models/AdminSettings.ts

#### `src/lib/config/driver.ts`
- Description: Library module for config
- Exports/defines: carTypeToCapacity, CAR_TYPES, CAR_TYPE_LIST, CarType, CarTypeConfig
- Imported by: src/app/api/auth/me/route.ts; src/app/profile/DriverProfileClient.tsx; src/app/profile/verification/DriverVerificationClient.tsx

#### `src/lib/config/driverPlaceholder.ts`
- Description: Library module for config
- Exports/defines: PLACEHOLDER_DRIVER, PlaceholderDriver
- Imported by: none found

#### `src/lib/config/earnings.ts`
- Description: Library module for config
- Exports/defines: driverEarningFromTrip, DRIVER_EARNINGS_RATE, MIN_WITHDRAWAL_EGP, MAX_WITHDRAWAL_EGP
- Imported by: src/app/api/wallet/withdraw/route.ts; src/lib/services/tripEarnings.ts

#### `src/lib/config/environment.ts`
- Description: Library module for config
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `src/lib/config/featureFlags.ts`
- Description: Library module for config
- Exports/defines: isMultiDayRequestsEnabled, shouldCreateRequestGroup
- Imported by: src/app/api/trips/route.ts; src/app/create/page.tsx

#### `src/lib/config/mapSettings.ts`
- Description: Library module for config
- Exports/defines: defaultMapSettings, OSM_THEMES, MapProviderName, MapCanvasStyle, OsmMapThemeName, MapSettings
- Imported by: src/app/api/admin/maps/route.ts; src/components/admin/MapSettingsManager.tsx; src/components/create/CreateClient.tsx; src/components/create/CreateMapGoogle.tsx; src/components/create/CreateMapOsm.tsx; src/components/create/TripCycle.tsx; src/components/map/OsmMapCanvas.tsx; src/lib/MapSearchContext.tsx; src/lib/maps/settings.ts

#### `src/lib/config/regions.ts`
- Description: Library module for config
- Exports/defines: isRegionCode, isRegionKey, normalizeRegion, getRegionConfig, getRegionBySlug, getMapConfig, getCurrencyConfig, isVehicleAvailableInRegion, vehicleKeysForRegion, vehiclesForRegion, regionFromCoordinates, REGION_CODES
- Imported by: src/app/[region]/admin/layout.tsx; src/app/[region]/admin/operation/page.tsx; src/app/[region]/admin/stations/page.tsx; src/app/admin/layout.tsx; src/app/admin/users/page.tsx; src/app/api/admin/availability/route.ts; src/app/api/admin/maps/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/auth/me/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/stations/route.ts; src/app/api/vehicles/route.ts; src/app/create/page.tsx; src/app/login/page.tsx; src/app/profile/ProfileClient.tsx; src/components/admin/MapSettingsManager.tsx; src/components/admin/UserManagementClient.tsx; src/components/admin/VehiclesManager.tsx; src/components/admin/layout/AdminShell.tsx; src/components/auth/DriverRegisterForm.tsx; src/components/create/CreateClient.tsx; src/components/create/CreateMap.tsx; src/components/create/CreateMapGoogle.tsx; src/components/create/CreateMapOsm.tsx; src/components/create/TripCycle.tsx; src/components/landing/VehicleTypes.tsx; src/lib/admin/vehicleInput.ts; src/lib/config/mapSettings.ts; src/lib/db/getVehicles.ts; src/lib/db/seedVehicles.ts; src/lib/geo/stations.ts; src/lib/maps/settings.ts; src/lib/money.ts; src/lib/regions/resolveActiveRegion.ts; src/lib/services/availability.ts; src/lib/services/profile.ts; src/lib/services/rideService.ts; src/lib/stations/publishDataset.ts; src/lib/vehicles/regionConfig.ts; src/types/geo.ts

#### `src/lib/config/site.ts`
- Description: Library module for config
- Exports/defines: SUPPORT_EMAIL
- Imported by: src/components/layout/Footer.tsx; src/lib/email/sendContactEmail.ts

#### `src/lib/config/vehicles.ts`
- Description: Library module for config
- Exports/defines: priceFor, waitingCostEgp, maxExtraPassengers, finalPrice, computeTripPriceForSelection, priceForSelectedDates, priceForSelectedDate, computeTripPriceEgp, privateRouteLegPrices, privateRoutePrice, computePrivateTripPriceEgp, VEHICLES
- Imported by: src/app/admin/rides/page.tsx; src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/trips/route.ts; src/app/my-trips/page.tsx; src/components/admin/VehiclesManager.tsx; src/components/create/CreateClient.tsx; src/components/create/TripCycle.tsx; src/components/landing/VehicleTypes.tsx; src/components/trips/DriverRideInteractiveClient.tsx; src/lib/config/regions.ts; src/lib/db/getVehicles.ts; src/lib/db/seedVehicles.ts; src/lib/time/pickupWindow.ts; src/lib/vehicles/regionConfig.ts

#### `src/lib/config/verification.ts`
- Description: Library module for config
- Exports/defines: isVerificationMethod, questionText, getSecurityQuestion, isValidSecurityQuestionId, VERIFICATION_METHODS, DEFAULT_VERIFICATION_METHOD, SECURITY_QUESTIONS, VerificationMethod
- Imported by: src/app/api/admin/settings/route.ts; src/app/api/auth/change-password/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/security-question/setup/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/auth/verification-config/route.ts; src/components/admin/CancellationSettingsForm.tsx; src/lib/auth/securityQuestion.ts; src/lib/auth/useVerificationConfig.ts

#### `src/lib/countdown.ts`
- Description: Library module for 
- Exports/defines: getCountdown, getCairoPickupAt, Countdown
- Imported by: src/components/trips/NextTripCard.tsx; src/components/trips/NextTripCountdown.tsx

#### `src/lib/db/getVehicles.ts`
- Description: Library module for db
- Exports/defines: invalidateVehiclesCache, getVehicles
- Imported by: src/app/api/admin/vehicles/[key]/route.ts; src/app/api/admin/vehicles/route.ts; src/app/api/trips/route.ts

#### `src/lib/db/mongoose.ts`
- Description: Library module for db
- Exports/defines: connectDB
- Imported by: src/app/admin/availability/page.tsx; src/app/admin/dashboard/page.tsx; src/app/admin/notifications/page.tsx; src/app/admin/transactions/[id]/page.tsx; src/app/admin/transactions/page.tsx; src/app/admin/users/page.tsx; src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/availability/[id]/route.ts; src/app/api/admin/availability/export/route.ts; src/app/api/admin/availability/restore/route.ts; src/app/api/admin/availability/route.ts; src/app/api/admin/drivers/[id]/wallet-settings/route.ts; src/app/api/admin/drivers/route.ts; src/app/api/admin/getDriverRequests/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/getPrivateRideRequests/route.ts; src/app/api/admin/getSharedRideRequests/route.ts; src/app/api/admin/login/route.ts; src/app/api/admin/maps/route.ts; src/app/api/admin/match-ride/route.ts; src/app/api/admin/notifications/route.ts; src/app/api/admin/notifications/templates/[id]/route.ts; src/app/api/admin/notifications/templates/route.ts; src/app/api/admin/promo-codes/[id]/logs/route.ts; src/app/api/admin/promo-codes/[id]/route.ts; src/app/api/admin/promo-codes/route.ts; src/app/api/admin/referral-campaigns/route.ts; src/app/api/admin/referral-settings/history/route.ts; src/app/api/admin/referral/pending/route.ts; src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/refund-requests/[id]/reject/route.ts; src/app/api/admin/refund-requests/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/rides/[id]/route.ts; src/app/api/admin/rides/purge-today/route.ts; src/app/api/admin/rides/purge/route.ts; src/app/api/admin/rides/route.ts; src/app/api/admin/settings/route.ts; src/app/api/admin/settings/waiting-list/route.ts; src/app/api/admin/shiftDates/route.ts; src/app/api/admin/signup/route.ts; src/app/api/admin/station-datasets/[id]/download/route.ts; src/app/api/admin/station-datasets/[id]/preview/route.ts; src/app/api/admin/station-datasets/[id]/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts; src/app/api/admin/station-datasets/from-file/route.ts; src/app/api/admin/station-datasets/history/route.ts; src/app/api/admin/station-datasets/upload/route.ts; src/app/api/admin/station-operations/audit/route.ts; src/app/api/admin/station-operations/summary/route.ts; src/app/api/admin/stations/matrix/route.ts; src/app/api/admin/stations/route.ts; src/app/api/admin/stats/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/export/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/transactions/reports/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/admin/transactions/timeseries/route.ts; src/app/api/admin/trips/[id]/assign/route.ts; src/app/api/admin/trips/[id]/available-drivers/route.ts; src/app/api/admin/trips/[id]/route.ts; src/app/api/admin/trips/route.ts; src/app/api/admin/users/[id]/referral-unlimited/route.ts; src/app/api/admin/users/[id]/reset-password/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/admin/users/route.ts; src/app/api/admin/users/search/route.ts; src/app/api/admin/users/unlimited/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/admin/waiting-list/count/route.ts; src/app/api/admin/waiting-list/route.ts; src/app/api/admin/withdrawals/route.ts; src/app/api/auth/addresses/[id]/route.ts; src/app/api/auth/addresses/route.ts; src/app/api/auth/change-password/route.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/login/route.ts; src/app/api/auth/me/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/otp/verify/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/security-question/setup/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/driver/availability/[id]/route.ts; src/app/api/driver/availability/route.ts; src/app/api/driver/rides/[id]/accept/route.ts; src/app/api/driver/rides/[id]/reject/route.ts; src/app/api/driver/submit-review/route.ts; src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/logs/[logId]/route.ts; src/app/api/logs/driver/[driverId]/route.ts; src/app/api/logs/route.ts; src/app/api/logs/trip/[tripId]/route.ts; src/app/api/logs/user/[userId]/route.ts; src/app/api/notifications/[id]/read/route.ts; src/app/api/notifications/[id]/route.ts; src/app/api/notifications/read-all/route.ts; src/app/api/notifications/route.ts; src/app/api/notifications/unread/route.ts; src/app/api/payments/[id]/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/push/subscriptions/route.ts; src/app/api/referral/my-code/route.ts; src/app/api/ride/[id]/passengers/[tripId]/route.ts; src/app/api/ride/[id]/route.ts; src/app/api/ride/route.ts; src/app/api/stations/[id]/route.ts; src/app/api/stations/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/[id]/chat/route.ts; src/app/api/trips/[id]/rating/route.ts; src/app/api/trips/expire/route.ts; src/app/api/trips/route.ts; src/app/api/trips/spacing/route.ts; src/app/api/upload/[filename]/route.ts; src/app/api/upload/route.ts; src/app/api/vehicles/[key]/route.ts; src/app/api/wallet/payout-method/route.ts; src/app/api/wallet/topup/route.ts; src/app/api/wallet/withdraw/route.ts; src/app/my-requests/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/app/ride-requests/page.tsx; src/app/user/notifications/page.tsx; src/lib/auth/securityQuestion.ts; src/lib/cancellationPolicy.ts; src/lib/db/seedVehicles.ts; src/lib/maps/settings.ts; src/lib/middleware/adminAuth.ts; src/lib/notifications/createNotification.ts; src/lib/notifications/webPush.ts; src/lib/passengerCancellationPolicy.ts; src/lib/payments/kashier.ts; src/lib/payments/requestPaymentRecovery.ts; src/lib/payments/requestSettlement.ts; src/lib/promoCode.ts; src/lib/referral.ts; src/lib/regions/resolveActiveRegion.ts; src/lib/requestGroupCancellation.ts; src/lib/security/rateLimit.ts; src/lib/services/availability.ts; src/lib/services/booking-status.ts; src/lib/services/logService.ts; src/lib/services/profile.ts; src/lib/services/requests.ts; src/lib/services/rideService.ts; src/lib/services/standaloneTripExpiry.ts; src/lib/services/tripEarnings.ts; src/lib/services/trips.ts; src/lib/stations/publishDataset.ts; src/lib/wallet/wallet.ts

#### `src/lib/db/seedVehicles.ts`
- Description: Library module for db
- Exports/defines: ensureVehicleSeed
- Imported by: src/app/api/admin/vehicles/route.ts; src/app/api/vehicles/route.ts; src/lib/db/getVehicles.ts

#### `src/lib/email/sendContactEmail.ts`
- Description: Library module for email
- Exports/defines: sendContactEmail
- Imported by: src/app/api/contact/route.ts

#### `src/lib/environment.ts`
- Description: Library module for 
- Exports/defines: getMongoUri, getDbName, runtimeEnvironment, isProduction
- Imported by: src/lib/mongodb.ts

#### `src/lib/geo/stations.ts`
- Description: Library module for geo
- Exports/defines: isSharedVehicle, haversineKm, walkingMinutes, findNearestStations, findNearestStation, Station, StationOption
- Imported by: src/app/api/admin/availability/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/stations/matrix/route.ts; src/app/api/driver/availability/route.ts; src/app/api/trips/route.ts; src/app/my-trips/page.tsx; src/components/create/CreateClient.tsx; src/components/create/CreateMap.tsx; src/components/create/CreateMapGoogle.tsx; src/components/create/CreateMapOsm.tsx; src/components/create/TripCycle.tsx; src/components/trips/NextTripCard.tsx; src/lib/services/availability.ts; src/types/forms.ts

#### `src/lib/googleMapsStyle.ts`
- Description: Library module for 
- Exports/defines: MAP_STYLE
- Imported by: src/components/admin/MapSettingsManager.tsx; src/components/create/CreateMapGoogle.tsx

#### `src/lib/groupRequestTrips.ts`
- Description: Library module for 
- Exports/defines: groupTripsByRequest, RequestTripGroup, RequestTripGroupable
- Imported by: src/app/my-trips/history/page.tsx

#### `src/lib/i18n/client.tsx`
- Description: Library module for i18n
- Exports/defines: getLocaleFromCookie, setLocaleCookie, useClientLocale
- Imported by: src/app/admin/signup/page.tsx; src/app/availability/AvailabilityClient.tsx; src/app/forgot-password/page.tsx; src/app/login/page.tsx; src/app/profile/ProfileClient.tsx; src/components/admin/ReferralUserOverrides.tsx; src/components/admin/WaitingListClient.tsx; src/components/auth/DriverRegisterForm.tsx; src/components/layout/NotificationCenter.tsx; src/components/shared/ChangePasswordSection.tsx; src/components/shared/DateRangeCalendar.tsx; src/components/shared/LogoutConfirmModal.tsx; src/components/shared/PasswordStrengthMeter.tsx; src/components/shared/PhoneVerificationCard.tsx; src/components/shared/ReferralCard.tsx; src/components/shared/RouteMapOsm.tsx; src/components/shared/SecurityQuestionSetupCard.tsx; src/components/shared/TripChat.tsx; src/components/trips/DriverRideInteractiveClient.tsx; src/components/trips/TripDetailParts.tsx; src/components/trips/VehicleSeatMap.tsx; src/lib/locale.client.tsx

#### `src/lib/i18n/config.ts`
- Description: Library module for i18n
- Exports/defines: isLocale, parseLocale, localeDirection, intlLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, Locale
- Imported by: src/app/forgot-password/page.tsx; src/app/layout.tsx; src/app/login/page.tsx; src/app/ride-requests/page.tsx; src/lib/i18n/client.tsx; src/lib/i18n/index.ts; src/lib/i18n/multiDayBooking.ts; src/lib/i18n/server.ts; src/lib/locale.ts

#### `src/lib/i18n/index.ts`
- Description: Library module for i18n
- Exports/defines: toArabicDigits, translate, formatDate, formatTime, formatTimeRange, formatHourMinuteRange, formatDistanceKm, formatMinutes, formatEgp,  formatMoney , 
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  isLocale,
  parseLocale,
  localeDirection,
  intlLocale,

- Imported by: src/app/admin/waiting-list/page.tsx; src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/app/ride-requests/page.tsx; src/app/user/notifications/loading.tsx; src/app/user/notifications/page.tsx; src/components/admin/WaitingListClient.tsx; src/components/create/CreateClient.tsx; src/components/create/DatePicker.tsx; src/components/create/TripCycle.tsx; src/components/trips/DriverRideInteractiveClient.tsx; src/components/trips/NextTripCard.tsx; src/components/trips/NextTripCountdown.tsx; src/components/trips/PrivateRideDetails.tsx; src/components/trips/RequestGroupCancellationControls.tsx; src/components/trips/RideOfferCard.tsx; src/components/trips/SharedRideDetails.tsx; src/components/trips/VehicleSeatMap.tsx; src/components/wallet/WalletClient.tsx; src/lib/i18n/client.tsx; src/lib/locale.ts

#### `src/lib/i18n/messages/ar.ts`
- Description: Library module for i18n/messages
- Exports/defines: ar
- Imported by: src/lib/i18n/messages/index.ts

#### `src/lib/i18n/messages/en.ts`
- Description: Library module for i18n/messages
- Exports/defines: en, MessageKey
- Imported by: src/lib/i18n/messages/ar.ts; src/lib/i18n/messages/index.ts

#### `src/lib/i18n/messages/index.ts`
- Description: Library module for i18n/messages
- Exports/defines: MESSAGES
- Imported by: src/lib/i18n/index.ts

#### `src/lib/i18n/multiDayBooking.ts`
- Description: Library module for i18n
- Exports/defines: multiDayBookingCountKey
- Imported by: src/app/my-trips/page.tsx

#### `src/lib/i18n/server.ts`
- Description: Library module for i18n
- Exports/defines: getServerLocale
- Imported by: src/app/admin/waiting-list/page.tsx; src/app/layout.tsx; src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/app/ride-requests/page.tsx; src/app/user/notifications/loading.tsx; src/app/user/notifications/page.tsx

#### `src/lib/leaflet.ts`
- Description: Library module for 
- Exports/defines: loadLeaflet, svgDataUrl, dashedLinePattern, MAP_COLORS, LeafletModule
- Imported by: src/components/admin/AdminTripMap.tsx; src/components/availability/AvailabilityMap.tsx; src/components/create/CreateMap.tsx; src/components/map/LocationPickerMap.tsx; src/components/map/PickupMapInner.tsx; src/components/shared/RouteMap.tsx

#### `src/lib/locale.client.tsx`
- Description: Library module for 
- Exports/defines:  getLocaleFromCookie, setLocaleCookie, useClientLocale 
- Imported by: none found

#### `src/lib/locale.ts`
- Description: Library module for 
- Exports/defines:  localeDirection ,  translate 
- Imported by: src/app/my-trips/[id]/error.tsx; src/app/profile/DriverProfileClient.tsx; src/app/profile/verification/DriverVerificationClient.tsx; src/app/terms/page.tsx; src/components/admin/PromoCodesManager.tsx; src/components/contact/ContactForm.tsx; src/components/contact/ContactHeader.tsx; src/components/create/CreateClient.tsx; src/components/create/DatePicker.tsx; src/components/create/TripCycle.tsx; src/components/faq/FAQContent.tsx; src/components/landing/CTA.tsx; src/components/landing/Hero.tsx; src/components/landing/HowItWorks.tsx; src/components/landing/WhyCommuter.tsx; src/components/layout/AppHeader.tsx; src/components/layout/Footer.tsx; src/components/layout/LanguageToggle.tsx; src/components/map/LocationPickerMapOsm.tsx; src/components/shared/ContinueCheckoutButton.tsx; src/components/shared/SavedAddressesSection.tsx; src/components/shared/StatusGroupFilter.tsx; src/components/trips/CancelTripModal.tsx; src/components/trips/DriverCard.tsx; src/components/trips/RateTripModal.tsx; src/components/trips/RideOfferCard.tsx; src/components/trips/TripHistoryControls.tsx; src/components/trips/TripHistoryFilters.tsx; src/components/trips/TripTabs.tsx; src/components/wallet/WalletClient.tsx

#### `src/lib/logging/multiday.ts`
- Description: Library module for logging
- Exports/defines: logMultiDayEvent
- Imported by: src/app/api/requests/[id]/cancel/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/route.ts

#### `src/lib/maps/settings.ts`
- Description: Library module for maps
- Exports/defines: getMapSettings
- Imported by: src/app/create/page.tsx

#### `src/lib/middleware/adminAuth.ts`
- Description: Library module for middleware
- Exports/defines: adminAuth
- Imported by: src/app/api/admin/activity-notifications/route.ts; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/availability/[id]/route.ts; src/app/api/admin/availability/export/route.ts; src/app/api/admin/availability/restore/route.ts; src/app/api/admin/availability/route.ts; src/app/api/admin/drivers/route.ts; src/app/api/admin/getDriverRequests/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/getPrivateRideRequests/route.ts; src/app/api/admin/getSharedRideRequests/route.ts; src/app/api/admin/match-ride/route.ts; src/app/api/admin/notifications/route.ts; src/app/api/admin/notifications/templates/[id]/route.ts; src/app/api/admin/notifications/templates/route.ts; src/app/api/admin/promo-codes/[id]/logs/route.ts; src/app/api/admin/promo-codes/[id]/route.ts; src/app/api/admin/promo-codes/route.ts; src/app/api/admin/referral-campaigns/route.ts; src/app/api/admin/referral-settings/history/route.ts; src/app/api/admin/referral-settings/route.ts; src/app/api/admin/referral/[referralUsageId]/reconcile/route.ts; src/app/api/admin/referral/pending/route.ts; src/app/api/admin/referral/reconcile/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/rides/[id]/route.ts; src/app/api/admin/rides/purge-today/route.ts; src/app/api/admin/rides/purge/route.ts; src/app/api/admin/rides/route.ts; src/app/api/admin/settings/waiting-list/route.ts; src/app/api/admin/shiftDates/route.ts; src/app/api/admin/sms/balance/route.ts; src/app/api/admin/station-datasets/[id]/download/route.ts; src/app/api/admin/station-datasets/[id]/preview/route.ts; src/app/api/admin/station-datasets/[id]/publish/route.ts; src/app/api/admin/station-datasets/[id]/rollback/route.ts; src/app/api/admin/station-datasets/[id]/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts; src/app/api/admin/station-datasets/from-file/route.ts; src/app/api/admin/station-datasets/history/route.ts; src/app/api/admin/station-datasets/upload/route.ts; src/app/api/admin/station-files/route.ts; src/app/api/admin/station-operations/audit/route.ts; src/app/api/admin/station-operations/summary/route.ts; src/app/api/admin/stations/matrix/route.ts; src/app/api/admin/stations/route.ts; src/app/api/admin/stats/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/export/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/transactions/reports/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/admin/transactions/timeseries/route.ts; src/app/api/admin/trips/[id]/assign/route.ts; src/app/api/admin/trips/[id]/available-drivers/route.ts; src/app/api/admin/trips/[id]/route.ts; src/app/api/admin/trips/route.ts; src/app/api/admin/users/[id]/referral-unlimited/route.ts; src/app/api/admin/users/[id]/reset-password/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/admin/users/route.ts; src/app/api/admin/users/search/route.ts; src/app/api/admin/users/unlimited/route.ts; src/app/api/admin/vehicles/[key]/route.ts; src/app/api/admin/vehicles/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/admin/waiting-list/count/route.ts; src/app/api/admin/waiting-list/route.ts; src/app/api/logs/[logId]/route.ts; src/app/api/logs/route.ts; src/app/api/stations/[id]/route.ts; src/app/api/stations/route.ts

#### `src/lib/money.ts`
- Description: Library module for 
- Exports/defines: formatMoney
- Imported by: src/lib/i18n/index.ts

#### `src/lib/mongodb.ts`
- Description: Library module for 
- Exports/defines: dbConnect
- Imported by: none found

#### `src/lib/nextTrip.ts`
- Description: Library module for 
- Exports/defines: getNextTrip
- Imported by: src/app/my-trips/page.tsx

#### `src/lib/nominatim.ts`
- Description: Library module for 
- Exports/defines: searchAddress, formatDisplayName, getPlaceDetails, reverseGeocode, NominatimResult
- Imported by: src/components/availability/AvailabilityMap.tsx; src/components/availability/AvailabilityMapOsm.tsx; src/components/create/CreateClient.tsx; src/components/create/CreateMap.tsx; src/components/create/CreateMapGoogle.tsx; src/components/create/CreateMapOsm.tsx; src/components/landing/AddressInput.tsx; src/components/map/LocationPickerMap.tsx; src/components/map/LocationPickerMapOsm.tsx

#### `src/lib/notifications/adminActivity.ts`
- Description: Library module for notifications
- Exports/defines: notifyAdminsOfCompletedPaidTrip, notifyAdminsOfPaidTrip, notifyAdminsOfLateTripPayment, notifyAdminsOfRequestPaymentIssue, notifyAdminsOfWaitingListTrip, notifyAdminsOfWaitingListTripBatch, notifyAdminsOfWaitingListRequest, syncPaidTripsForRequest, notifyAdminsOfAdminCampaignClaim
- Imported by: src/app/api/actions/ride/[rideId]/route.ts; src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/route.ts; src/lib/payments/kashier.ts; src/lib/payments/requestPaymentRecovery.ts; src/lib/referral.ts

#### `src/lib/notifications/createNotification.ts`
- Description: Library module for notifications
- Exports/defines: createNotification, createNotifications, CreateNotificationPayload
- Imported by: src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/trips/[id]/assign/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/route.ts; src/lib/notifications/welcomeNotification.ts; src/lib/payments/kashier.ts; src/lib/services/rideService.ts; src/lib/wallet/wallet.ts

#### `src/lib/notifications/ensureDefaultTemplates.ts`
- Description: Library module for notifications
- Exports/defines: ensureDefaultNotificationTemplates
- Imported by: src/app/admin/notifications/page.tsx; src/app/api/admin/notifications/templates/route.ts

#### `src/lib/notifications/notificationHref.ts`
- Description: Library module for notifications
- Exports/defines: getNotificationHref
- Imported by: src/components/layout/NotificationCenter.tsx

#### `src/lib/notifications/webPush.ts`
- Description: Library module for notifications
- Exports/defines: getVapidPublicKey, sendPushPayloadToUser, sendPushToUserNotification
- Imported by: src/app/api/admin/notifications/route.ts; src/app/api/push/vapid-public-key/route.ts; src/lib/notifications/adminActivity.ts; src/lib/notifications/createNotification.ts; src/lib/referral.ts

#### `src/lib/notifications/welcomeNotification.ts`
- Description: Library module for notifications
- Exports/defines: createWelcomeNotification
- Imported by: src/app/api/auth/register/route.ts; src/app/api/auth/signUpDriver/route.ts

#### `src/lib/openrouteservice.ts`
- Description: Library module for 
- Exports/defines: fetchRoute, ORSRoute
- Imported by: src/lib/useMapState.ts

#### `src/lib/osrm.ts`
- Description: Library module for 
- Exports/defines: fetchRoadRoute, fetchRoadRoutes, Waypoint, OSRMRoute
- Imported by: src/components/create/TripCycle.tsx; src/components/map/useRouteOSRM.ts

#### `src/lib/passengerCancellationPolicy.ts`
- Description: Library module for 
- Exports/defines: calendarDaysBeforeCairo, evaluatePassengerCancellationTier, evaluateTripCancellation, PassengerCancellationTier, EvaluationResult
- Imported by: src/app/api/trips/[id]/cancel/route.ts

#### `src/lib/payments/kashier.ts`
- Description: Library module for payments
- Exports/defines: verifyAndSettleBooking, verifyAndSettleTopup, refundKashierPayment, queryKashierRefundTransaction, resolveKashierRefundOrderId, reconcilePendingTopups, reconcileStaleReservations, KashierRefundLookup
- Imported by: src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/payments/verify/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/wallet/reconcile/route.ts; src/app/api/wallet/topup/verify/route.ts; src/app/checkout/callback/page.tsx; src/lib/requestGroupCancellation.ts

#### `src/lib/payments/kashierPayout.ts`
- Description: Library module for payments
- Exports/defines: initiateKashierPayout, queryKashierPayoutStatus, PayoutRecipient, PayoutResult,  maskDestination 
- Imported by: src/app/api/payments/webhook/route.ts; src/app/api/wallet/withdraw/route.ts

#### `src/lib/payments/kashierRefundReconciliation.ts`
- Description: Library module for payments
- Exports/defines: reconcileKashierRefund
- Imported by: src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/payments/webhook/route.ts

#### `src/lib/payments/requestPaymentRecovery.ts`
- Description: Library module for payments
- Exports/defines: handlePaidRequestPayment
- Imported by: src/app/api/payments/webhook/route.ts; src/lib/payments/kashier.ts

#### `src/lib/payments/requestPaymentRecoveryDecision.ts`
- Description: Library module for payments
- Exports/defines: recoverPaidRequestPayment, RequestPaymentRecoveryIssue, RequestPaymentRecoveryInput, RequestPaymentRecoveryOperations
- Imported by: src/lib/payments/requestPaymentRecovery.ts

#### `src/lib/payments/requestSessionEligibility.ts`
- Description: Library module for payments
- Exports/defines: getRequestPaymentSessionBlock, RequestPaymentSessionBlock
- Imported by: src/app/api/payments/session/route.ts

#### `src/lib/payments/requestSettlement.ts`
- Description: Library module for payments
- Exports/defines: settleRequestPayment, RequestSettlementResult
- Imported by: src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/lib/payments/kashier.ts; src/lib/payments/requestPaymentRecovery.ts

#### `src/lib/payments/requestSettlementFlow.ts`
- Description: Library module for payments
- Exports/defines: runRequestSettlementWith, RequestSettlementFlowResult, RequestSettlementFlowOperations
- Imported by: src/lib/payments/requestSettlement.ts

#### `src/lib/payments/resolveBooking.ts`
- Description: Library module for payments
- Exports/defines: resolvePayableBooking, isTripSettlementBlocked, PayableBooking, 
  isApprovedTripPickupPast,
  isStandaloneTripPayable,
  isStandaloneTripRecord,
  resolvePayableBookingWith,

- Imported by: src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/lib/payments/kashier.ts; src/lib/payments/kashierRefundReconciliation.ts; src/lib/services/booking-status.ts

#### `src/lib/payments/resolvePayableBookingRecord.ts`
- Description: Library module for payments
- Exports/defines: isStandaloneTripRecord, isStandaloneTripPayable, isApprovedTripPickupPast, resolvePayableBookingWith
- Imported by: src/lib/payments/resolveBooking.ts; src/lib/statusDisplay.ts

#### `src/lib/payments/sessionGuards.ts`
- Description: Library module for payments
- Exports/defines: splitTripPaymentAmount, formatKashierAmount, validatePaymentAppUrl, canContinueStandaloneTripPayment, PaymentAppUrlValidation, PaymentAppUrlEnvironment
- Imported by: src/app/api/payments/session/route.ts; src/app/api/wallet/topup/route.ts

#### `src/lib/payments/sessionTiming.ts`
- Description: Library module for payments
- Exports/defines: isRequestPaymentSessionExpired, verifyExpiredRequestPayments, KASHIER_SESSION_DURATION_MS, PAYMENT_CANCELLATION_GRACE_MS
- Imported by: src/app/api/payments/session/route.ts; src/lib/requestGroupCancellation.ts

#### `src/lib/payments/settlementAttempt.ts`
- Description: Library module for payments
- Exports/defines: isInFlightPaymentStatus, shouldResetFailedTripForRetry, canTripTakePaymentFailure, runStandalonePaymentFailure, runStandaloneSettlementSteps, ACTIVE_PAYMENT_STATUSES
- Imported by: src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/lib/payments/requestSettlement.ts; src/lib/payments/standaloneTripSettlement.ts

#### `src/lib/payments/standaloneTripSettlement.ts`
- Description: Library module for payments
- Exports/defines: settleStandaloneTripPayment, failStandaloneTripPayment
- Imported by: src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/lib/payments/kashier.ts

#### `src/lib/payments/tripSettlement.ts`
- Description: Library module for payments
- Exports/defines: isTripSettlementBlockedStatus, settleTripOnce, fullyRefundedTripUpdate, TripSettlementOutcome
- Imported by: src/app/api/admin/transactions/refund/route.ts; src/lib/payments/kashierRefundReconciliation.ts; src/lib/payments/resolveBooking.ts

#### `src/lib/pendingRequestHardening.ts`
- Description: Library module for 
- Exports/defines: buildPendingRequestExpiryFilter, buildPendingTripExpiryFilter, buildSettlementRequestFilter, isSettlementBlockedStatus, SETTLEMENT_BLOCKED_STATUSES
- Imported by: src/app/api/payments/webhook/route.ts; src/app/api/trips/expire/route.ts; src/lib/payments/kashier.ts; src/lib/payments/requestSettlement.ts; src/lib/services/requests.ts

#### `src/lib/phase8bGuards.ts`
- Description: Library module for 
- Exports/defines: isTransientBookingConflict, isAuthorizedExpiryRequest, spacingLockUpsertFields, latePaymentDedupeKey, safeKashierErrorFields
- Imported by: src/app/api/payments/session/route.ts; src/app/api/trips/expire/route.ts; src/app/api/trips/route.ts; src/lib/notifications/adminActivity.ts

#### `src/lib/promoCode.ts`
- Description: Library module for 
- Exports/defines: normalizePromoCode, computePromoDiscountedPrice, generatePromoCode, validateAndPreviewPromoCode, applyPromoCodeToTrip, rollbackPromoCodeUsage, releasePromoCodeUsageForTrip, releasePromoForRequest, PromoDiscountType, PromoCodePreviewResult, PromoCodeApplyResult
- Imported by: src/app/api/admin/promo-codes/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/promo-codes/validate/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/expire/route.ts; src/app/api/trips/route.ts; src/lib/requestGroupCancellation.ts; src/lib/services/requests.ts; src/lib/services/standaloneTripExpiry.ts

#### `src/lib/promoCodeShared.ts`
- Description: Library module for 
- Exports/defines: isPromoCodeExpired, hasPromoLimitingFactor, computePromoExpiryFromDuration, PromoExpiryInput
- Imported by: src/app/api/admin/promo-codes/[id]/route.ts; src/app/api/admin/promo-codes/route.ts; src/components/admin/PromoCodesManager.tsx; src/lib/promoCode.ts

#### `src/lib/promoUsageRelease.ts`
- Description: Library module for 
- Exports/defines: releasePromoUsageForTripWith, PromoUsageReleaseRecord, PromoUsageReleaseStore
- Imported by: src/lib/promoCode.ts

#### `src/lib/referral.ts`
- Description: Library module for 
- Exports/defines: generateAdminReferralToken, getOrCreateAdminReferralCampaign, getOrCreateReferralSettings, generateReferralCode, applyReferralOnSignup, creditReferralBonusIfEligible, reconcileReferralUsage, ReferralResult
- Imported by: src/app/admin/referral-settings/page.tsx; src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/referral-campaigns/route.ts; src/app/api/admin/referral-settings/route.ts; src/app/api/admin/referral/[referralUsageId]/reconcile/route.ts; src/app/api/admin/referral/reconcile/route.ts; src/app/api/admin/users/search/route.ts; src/app/api/admin/users/unlimited/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/referral/my-code/route.ts

#### `src/lib/regions/resolveActiveRegion.ts`
- Description: Library module for regions
- Exports/defines: resolveActiveRegion, legacyDefaultRegion, RegionAccessError, ActiveRegion
- Imported by: src/app/[region]/admin/layout.tsx; src/app/admin/layout.tsx; src/app/admin/operation/page.tsx; src/app/admin/stations/page.tsx; src/app/api/driver/availability/route.ts; src/app/api/stations/route.ts; src/app/api/trips/route.ts; src/app/availability/page.tsx; src/lib/middleware/adminAuth.ts

#### `src/lib/requestGroupCancellation.ts`
- Description: Library module for 
- Exports/defines: cancelRequestDay, cancelWholeRequest, 
  cancelRequestDayWith,
  cancelWholeRequestWith,
  RequestGroupCancellationError,

- Imported by: src/app/api/requests/[id]/cancel/route.ts; src/app/api/trips/[id]/cancel/route.ts

#### `src/lib/requestGroupCancellationCore.ts`
- Description: Library module for 
- Exports/defines: cancelRequestDayWith, cancelWholeRequestWith, RequestGroupCancellationError, RequestGroupCancellationTrip, RequestGroupCancellationRequest, RequestGroupCancellationStore
- Imported by: src/lib/requestGroupCancellation.ts

#### `src/lib/requestGroupCreation.ts`
- Description: Library module for 
- Exports/defines: createRequestGroupWith, saveRequestGroup, InvalidRequestGroupError, RequestGroupPromoError, RequestGroupCreationStore
- Imported by: src/app/api/trips/route.ts

#### `src/lib/requestPaymentState.ts`
- Description: Library module for 
- Exports/defines: wasMoneyTaken, getRequestPaymentState, RequestPaymentStateInput, RequestPaymentState
- Imported by: src/app/api/trips/[id]/cancel/route.ts; src/lib/statusDisplay.ts

#### `src/lib/requestPromoRelease.ts`
- Description: Library module for 
- Exports/defines: releasePromoForRequestWith, RequestPromoReleaseTrip, RequestPromoReleaseState, RequestPromoReleaseStore
- Imported by: src/lib/promoCode.ts

#### `src/lib/security/rateLimit.ts`
- Description: Library module for security
- Exports/defines: enforceRateLimit
- Imported by: src/app/api/auth/forgot-password/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/otp/verify/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/security-question/setup/route.ts

#### `src/lib/security/request.ts`
- Description: Library module for security
- Exports/defines: validateMutationRequest, normalizePlainText, normalizeEmail, isSafePassword, isPasswordInput, isPositiveEgpAmount
- Imported by: src/app/api/admin/login/route.ts; src/app/api/admin/signup/route.ts; src/app/api/admin/station-datasets/upload/route.ts; src/app/api/admin/users/[id]/reset-password/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/admin/vehicles/[key]/route.ts; src/app/api/admin/vehicles/route.ts; src/app/api/auth/addresses/[id]/route.ts; src/app/api/auth/addresses/route.ts; src/app/api/auth/change-password/route.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/login/route.ts; src/app/api/auth/logout/route.ts; src/app/api/auth/me/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/otp/verify/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/security-question/setup/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/verify/route.ts; src/app/api/payments/wallet/route.ts; src/app/api/push/subscriptions/route.ts; src/app/api/wallet/payout-method/route.ts; src/app/api/wallet/reconcile/route.ts; src/app/api/wallet/topup/route.ts; src/app/api/wallet/topup/verify/route.ts; src/app/api/wallet/withdraw/route.ts; src/lib/admin/vehicleInput.ts

#### `src/lib/services/availability.ts`
- Description: Library module for services
- Exports/defines: listDriverAvailability, DAYS_OF_WEEK, DayOfWeek, AvailabilityRecord,  MAX_AVAILABILITY_MINUTES, validateAvailabilityWindow 
- Imported by: src/app/api/admin/availability/[id]/route.ts; src/app/api/admin/availability/restore/route.ts; src/app/api/admin/availability/route.ts; src/app/api/driver/availability/route.ts; src/app/availability/page.tsx

#### `src/lib/services/booking-status.ts`
- Description: Library module for services
- Exports/defines: getBookingStatus, BookingStatusDetail
- Imported by: src/app/api/bookings/[id]/status/route.ts; src/app/checkout/callback/page.tsx

#### `src/lib/services/logActionHelpers.ts`
- Description: Library module for services
- Exports/defines: logPaymentInitiated, logPaymentCompleted, logPaymentFailed, logDriverAccepted, logDriverRejected, logDriverCancelled, logUserCancelled, logTripMatched, logTripStarted, logTripCompleted, logTripTimeout, logTripNomatch
- Imported by: src/app/api/driver/rides/[id]/accept/route.ts; src/app/api/driver/rides/[id]/reject/route.ts; src/app/api/trips/expire/route.ts

#### `src/lib/services/logService.ts`
- Description: Library module for services
- Exports/defines: createLog, getTripLogs, getLogs, getLogById, deleteLog, getTripLogHistory, getUserActivityLogs, getDriverActivityLogs, CreateLogInput
- Imported by: src/lib/services/logActionHelpers.ts; src/lib/services/rideActionHelpers.ts

#### `src/lib/services/profile.ts`
- Description: Library module for services
- Exports/defines: getProfile, PassengerProfile, DriverProfile
- Imported by: src/app/api/auth/me/route.ts; src/app/availability/page.tsx; src/app/create/page.tsx; src/app/profile/page.tsx; src/app/profile/verification/page.tsx

#### `src/lib/services/requests.ts`
- Description: Library module for services
- Exports/defines: expireStaleForUser, expireStaleRequest, listUserRequests, getUserRequest, ListUserRequestsOptions, RequestTripDetail, UserRequestDetail
- Imported by: src/app/api/requests/[id]/route.ts; src/app/api/requests/route.ts

#### `src/lib/services/rideActionHelpers.ts`
- Description: Library module for services
- Exports/defines: logRideStarted, logStationArrived, logBoardingAlighting, logPickupArrived, logPassengerPickedUp, logNoShow, logStopPointArrived, logRideCompleted
- Imported by: src/app/api/actions/ride/[rideId]/route.ts

#### `src/lib/services/rideMatching.ts`
- Description: Library module for services
- Exports/defines: getEligibleDriverIds
- Imported by: src/lib/services/rideService.ts

#### `src/lib/services/rideService.ts`
- Description: Library module for services
- Exports/defines: ListDriverRidesOptions, 
  createRide,
  getRideById,
  getDriverRide,
  getRideByNumber,
  getRidesByDriver,
  getRideByPassengerIncluded,
  getActiveRideForDriver,
  listDriverRideOffers,
  getRideByAvailability,
  updateRideStatus,
  updatePassengerStatusInRide,
  addPassengerToRide,
  removePassengerFromRide,
  recalculateRoute,
  cancelRide,
  cancelRideByDriver,
  deleteRideAndRestoreTrips,

- Imported by: src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/rides/[id]/route.ts; src/app/api/admin/rides/route.ts; src/app/api/ride/[id]/passengers/[tripId]/route.ts; src/app/api/ride/[id]/route.ts; src/app/api/ride/route.ts; src/app/my-trips/[id]/page.tsx; src/app/my-trips/page.tsx; src/app/ride-requests/page.tsx

#### `src/lib/services/sharedRideManifest.ts`
- Description: Library module for services
- Exports/defines: normalizeSharedRidePassengers, getSharedRouteStopCounts
- Imported by: src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/rides/[id]/route.ts; src/lib/services/rideService.ts

#### `src/lib/services/standaloneTripExpiry.ts`
- Description: Library module for services
- Exports/defines: expireStandaloneTrips, cancelStandaloneTripPayments
- Imported by: src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/expire/route.ts; src/lib/services/requests.ts

#### `src/lib/services/tripEarnings.ts`
- Description: Library module for services
- Exports/defines: settleTripEarning, reconcileDriverEarnings
- Imported by: src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/wallet/route.ts

#### `src/lib/services/trips.ts`
- Description: Library module for services
- Exports/defines: getDriverSummaryByUserNumber, buildAssignedDriver, listDriverTrips, listUserTrips, getDriverTrip, getUserTrip, StationOption, AssignedDriver, DriverSummarySnapshot, ListUserTripsOptions, UserTripDetail
- Imported by: src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/driver/rides/[id]/accept/route.ts; src/app/api/driver/trips/route.ts; src/app/api/trips/[id]/route.ts; src/app/api/trips/route.ts; src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/components/trips/SharedRideDetails.tsx

#### `src/lib/sharedRideStepper.ts`
- Description: Library module for 
- Exports/defines: getSharedRideStep, SharedRideStep
- Imported by: src/app/my-trips/[id]/page.tsx

#### `src/lib/smsmisr.ts`
- Description: Library module for 
- Exports/defines: sendSmsMisrOtp, getSmsMisrBalance
- Imported by: src/app/api/admin/sms/balance/route.ts; src/app/api/auth/otp/request/route.ts

#### `src/lib/standaloneTripCancellation.ts`
- Description: Library module for 
- Exports/defines: isStandaloneTripForCancellation, buildPassengerTripCancellationFilter, getStandaloneTripCancellationMode, runStandaloneTripCancellation, StandaloneTripCancellationMode, StandaloneTripCancellationRecord
- Imported by: src/app/api/trips/[id]/cancel/route.ts; src/components/trips/CancelTripModal.tsx; src/lib/statusDisplay.ts

#### `src/lib/standaloneTripExpiry.ts`
- Description: Library module for 
- Exports/defines: cancelStandaloneTripPayments, runStandaloneTripExpiry, StandaloneTripExpiryCandidate, StandalonePaymentExpiryCandidate, StandaloneTripExpiryStore
- Imported by: src/lib/services/standaloneTripExpiry.ts

#### `src/lib/stations/diffDataset.ts`
- Description: Library module for stations
- Exports/defines: diffStationDataset, diffStationDatasetDetailed, StationDatasetDiff, StationDatasetDiffDetails
- Imported by: src/app/api/admin/station-datasets/[id]/preview/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts

#### `src/lib/stations/publishDataset.ts`
- Description: Library module for stations
- Exports/defines: publishStationDataset, StationPublishError
- Imported by: src/app/api/admin/station-datasets/[id]/publish/route.ts; src/app/api/admin/station-datasets/[id]/rollback/route.ts

#### `src/lib/stations/validateGeoJson.ts`
- Description: Library module for stations
- Exports/defines: validateStationGeoJson, StationDatasetRecord, StationValidationIssue, StationValidationResult
- Imported by: src/app/api/admin/station-datasets/[id]/validate/route.ts; src/lib/stations/diffDataset.ts

#### `src/lib/statusDisplay.ts`
- Description: Library module for 
- Exports/defines: getDisplayStatus, getRejectionDisplay, DisplayStatus
- Imported by: src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/components/trips/NextTripCard.tsx; src/lib/sharedRideStepper.ts; src/lib/tripHistory.ts; src/lib/tripTabView.ts

#### `src/lib/storage/stationDatasetStorage.ts`
- Description: Library module for storage
- Exports/defines: putStationDatasetSource, getStationDatasetSource, deleteStationDatasetSource
- Imported by: src/app/api/admin/station-datasets/[id]/download/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts; src/app/api/admin/station-datasets/from-file/route.ts; src/app/api/admin/station-datasets/upload/route.ts

#### `src/lib/store/useTripStore.ts`
- Description: Library module for store
- Exports/defines: useTripStore, TripPoint
- Imported by: src/app/availability/AvailabilityClient.tsx; src/components/availability/AvailabilityMap.tsx; src/components/availability/AvailabilityMapOsm.tsx; src/components/create/CreateClient.tsx; src/components/create/CreateMap.tsx; src/components/create/CreateMapGoogle.tsx; src/components/create/CreateMapOsm.tsx; src/components/create/TripCycle.tsx; src/components/landing/AddressInput.tsx; src/components/landing/Hero.tsx; src/components/layout/AppHeader.tsx; src/components/shared/SavedAddressesSection.tsx

#### `src/lib/time/availabilityWindow.ts`
- Description: Library module for time
- Exports/defines: isValidAvailabilityId, validateAvailabilityWindow, shiftsOverlap, MAX_AVAILABILITY_MINUTES, normalizeAvailabilityOrigin, normalizeAvailabilityDestination
- Imported by: src/app/api/admin/availability/[id]/route.ts; src/app/api/admin/availability/route.ts; src/app/api/driver/availability/route.ts; src/lib/services/availability.ts

#### `src/lib/time/bookingDates.ts`
- Description: Library module for time
- Exports/defines: earliestBookingDate, bookingWindow, isDateInWindow
- Imported by: src/app/api/trips/route.ts; src/components/create/CreateClient.tsx; src/components/create/DatePicker.tsx

#### `src/lib/time/cairoTime.ts`
- Description: Library module for time
- Exports/defines: getCairoNowParts, comparePickup, getMinutesUntilPickup, getPickupInstant, isPastPickup, hasPastPickup, CairoNowParts
- Imported by: src/components/trips/TripHistoryControls.tsx; src/lib/cancellationPolicy.ts; src/lib/countdown.ts; src/lib/nextTrip.ts; src/lib/services/trips.ts; src/lib/standaloneTripExpiry.ts; src/lib/statusDisplay.ts; src/lib/tripHistoryFilters.ts; src/lib/tripTabs.ts

#### `src/lib/time/pickupWindow.ts`
- Description: Library module for time
- Exports/defines: toMinutes, toHHMM, getArrivalSlots, getDayHalfHourSlots, snapToArrivalSlotMidpoint, pickupWindowRange, computePickupTime, computeArrivalTime, ARRIVAL_SLOT_START_MIN, ARRIVAL_SLOT_END_MIN, ARRIVAL_SLOT_STEP_MIN, ArrivalSlot
- Imported by: src/app/api/trips/route.ts; src/components/create/CreateClient.tsx; src/components/create/TripCycle.tsx

#### `src/lib/tripBatchCreation.ts`
- Description: Library module for 
- Exports/defines: createTripBatchWith, TripBatchSpacingConflictError, TooManyPendingTripsError, PromoDiscountType, TripBatchPromoResult, TripBatchCandidate, PreparedTripBatchCandidate, TripBatchCreationStore
- Imported by: src/app/api/trips/route.ts; src/lib/requestGroupCreation.ts

#### `src/lib/tripBooking.ts`
- Description: Library module for 
- Exports/defines: getTripBatchPayloadError, hasDuplicateDates, getTripBatchDateValidationError, buildTripBatchResponse, getInitialTripBookingState, MAX_BOOKING_DATES, MAX_PENDING_UNPAID_TRIPS, TripBatchPayloadError
- Imported by: src/app/api/trips/route.ts; src/lib/tripBatchCreation.ts

#### `src/lib/tripHistory.ts`
- Description: Library module for 
- Exports/defines: getTripHistoryCategory, matchesTripHistoryFilter, TripHistoryFilter, TripHistoryCategory, TripHistoryRequest, TripHistoryTrip
- Imported by: src/app/my-trips/history/page.tsx; src/components/trips/TripHistoryFilters.tsx; src/lib/tripHistoryFilters.ts

#### `src/lib/tripHistoryFilters.ts`
- Description: Library module for 
- Exports/defines: normalizeTripNumber, parseHistoryParams, pickupFallsInDateRange, requestGroupMatchesDateRange, buildHistoryTripMatch, HistoryParamsError, ParsedHistoryParams, HistoryDateRange, PickupDate
- Imported by: src/app/my-trips/history/page.tsx; src/lib/services/trips.ts

#### `src/lib/tripSpacingLockIndex.ts`
- Description: Library module for 
- Exports/defines: ensureTripSpacingLockTtlIndex
- Imported by: src/app/api/trips/route.ts

#### `src/lib/tripTabView.ts`
- Description: Library module for 
- Exports/defines: buildTripTabView, TripTabRow, TripTabItem, TripTabKey
- Imported by: src/app/my-trips/page.tsx

#### `src/lib/tripTabs.ts`
- Description: Library module for 
- Exports/defines: normalizePassengerTabKey, getTripTab, TripTab, PassengerTabKey
- Imported by: src/app/my-trips/page.tsx; src/components/trips/NextTripCard.tsx; src/lib/nextTrip.ts; src/lib/tripHistory.ts; src/lib/tripTabView.ts

#### `src/lib/useMapState.ts`
- Description: Library module for 
- Exports/defines: useMapState, Waypoint, MapState
- Imported by: src/lib/MapContext.tsx

#### `src/lib/validation/tripSpacing.ts`
- Description: Library module for validation
- Exports/defines: findSpacingConflict, hasSpacingConflict, MIN_TRIP_SPACING_MINUTES, HOLDING_TRIP_STATUSES, TripSpacingWindow, SpacingConflict
- Imported by: src/app/api/trips/route.ts; src/app/api/trips/spacing/route.ts; src/components/create/CreateClient.tsx; src/components/create/TripCycle.tsx; src/lib/tripBatchCreation.ts

#### `src/lib/vehicles/regionConfig.ts`
- Description: Library module for vehicles
- Exports/defines: vehicleForRegion
- Imported by: src/app/api/vehicles/route.ts; src/lib/db/getVehicles.ts

#### `src/lib/wallet/wallet.ts`
- Description: Library module for wallet
- Exports/defines: getOrCreateWallet, creditWallet, debitWallet, creditDriverEarning, reserveWithdrawal, completeWithdrawal, refundWithdrawal, reserveWallet, captureReservation, releaseReservation, reconcileWalletFromLedger, createWithdrawalRequest
- Imported by: src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/withdrawals/[id]/approve/route.ts; src/app/api/admin/withdrawals/[id]/reject/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/wallet/reconcile/route.ts; src/app/api/wallet/route.ts; src/app/api/wallet/withdraw/[id]/cancel/route.ts; src/app/api/wallet/withdraw/route.ts; src/app/my-trips/[id]/page.tsx; src/app/my-trips/page.tsx; src/lib/payments/kashier.ts; src/lib/payments/requestSettlement.ts; src/lib/payments/standaloneTripSettlement.ts; src/lib/services/requests.ts; src/lib/services/standaloneTripExpiry.ts; src/lib/services/tripEarnings.ts


### Models

#### `src/models/AdminActivityNotification.ts`
- Description: Mongoose model for AdminActivityNotification
- Exports/defines: AdminActivityNotification, AdminActivityNotificationDoc
- Imported by: src/app/api/admin/activity-notifications/route.ts; src/app/api/admin/notifications/route.ts; src/lib/notifications/adminActivity.ts

#### `src/models/AdminReferralAuditLog.ts`
- Description: Mongoose model for AdminReferralAuditLog
- Exports/defines: AdminReferralAuditLog, AdminReferralAuditLogDoc
- Imported by: src/app/api/admin/referral-campaigns/route.ts; src/lib/referral.ts

#### `src/models/AdminReferralCampaign.ts`
- Description: Mongoose model for AdminReferralCampaign
- Exports/defines: ADMIN_REFERRAL_ROLES, AdminReferralCampaign, AdminReferralRole, AdminReferralCampaignDoc
- Imported by: src/app/api/admin/referral-campaigns/route.ts; src/lib/referral.ts

#### `src/models/AdminReferralUsage.ts`
- Description: Mongoose model for AdminReferralUsage
- Exports/defines: AdminReferralUsage, AdminReferralUsageDoc
- Imported by: src/app/api/admin/referral-campaigns/route.ts; src/lib/notifications/adminActivity.ts; src/lib/referral.ts

#### `src/models/AdminSettings.ts`
- Description: Mongoose model for AdminSettings
- Exports/defines: AdminSettings, AdminSettingsDoc, 
  DEFAULT_PASSENGER_CANCELLATION_TIERS,
  type PassengerCancellationTierConfig,

- Imported by: src/app/api/admin/settings/route.ts; src/app/api/admin/settings/waiting-list/route.ts; src/app/api/trips/route.ts; src/app/api/vehicles/route.ts; src/lib/auth/securityQuestion.ts; src/lib/cancellationPolicy.ts; src/lib/passengerCancellationPolicy.ts

#### `src/models/Availability.ts`
- Description: Mongoose model for Availability
- Exports/defines: Availability, AvailabilityDoc
- Imported by: src/app/admin/availability/page.tsx; src/app/admin/dashboard/page.tsx; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/availability/[id]/route.ts; src/app/api/admin/availability/export/route.ts; src/app/api/admin/availability/restore/route.ts; src/app/api/admin/availability/route.ts; src/app/api/admin/getDriverRequests/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/match-ride/route.ts; src/app/api/admin/rides/[id]/route.ts; src/app/api/admin/rides/route.ts; src/app/api/admin/shiftDates/route.ts; src/app/api/admin/stats/route.ts; src/app/api/admin/trips/[id]/assign/route.ts; src/app/api/admin/trips/[id]/available-drivers/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/driver/availability/[id]/route.ts; src/app/api/driver/availability/route.ts; src/lib/services/availability.ts; src/lib/services/rideMatching.ts

#### `src/models/Counter.ts`
- Description: Mongoose model for Counter
- Exports/defines: nextSequence, Counter
- Imported by: src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/signup/route.ts; src/app/api/admin/station-datasets/from-file/route.ts; src/app/api/admin/station-datasets/upload/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/trips/route.ts

#### `src/models/Driver.ts`
- Description: Mongoose model for Driver
- Exports/defines: Driver, DriverDoc
- Imported by: src/app/admin/users/page.tsx; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/availability/route.ts; src/app/api/admin/drivers/route.ts; src/app/api/admin/getDriverRequests/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/auth/login/route.ts; src/app/api/auth/me/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/driver/availability/route.ts; src/app/api/driver/submit-review/route.ts; src/app/api/wallet/payout-method/route.ts; src/app/api/wallet/withdraw/route.ts; src/lib/services/profile.ts; src/lib/services/rideMatching.ts; src/lib/services/trips.ts

#### `src/models/Log.ts`
- Description: Mongoose model for Log
- Exports/defines: LogSchema, Log, LogDoc
- Imported by: src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/refund-requests/[id]/reject/route.ts; src/app/api/logs/[logId]/route.ts; src/app/api/logs/driver/[driverId]/route.ts; src/app/api/logs/route.ts; src/app/api/logs/trip/[tripId]/route.ts; src/app/api/logs/user/[userId]/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/lib/services/logService.ts

#### `src/models/MapSettings.ts`
- Description: Mongoose model for MapSettings
- Exports/defines: MapSettingsModel, MapSettingsDoc
- Imported by: src/app/api/admin/maps/route.ts; src/lib/maps/settings.ts

#### `src/models/Message.ts`
- Description: Mongoose model for Message
- Exports/defines: Message, MessageDoc
- Imported by: src/app/api/trips/[id]/chat/route.ts

#### `src/models/Notification.ts`
- Description: Mongoose model for Notification
- Exports/defines: Notification, NotificationDoc
- Imported by: src/app/admin/notifications/page.tsx; src/app/api/admin/notifications/route.ts; src/app/api/notifications/[id]/read/route.ts; src/app/api/notifications/[id]/route.ts; src/app/api/notifications/read-all/route.ts; src/app/api/notifications/route.ts; src/app/api/notifications/unread/route.ts; src/app/user/notifications/page.tsx; src/lib/notifications/createNotification.ts; src/lib/notifications/webPush.ts; src/lib/referral.ts

#### `src/models/NotificationTemplate.ts`
- Description: Mongoose model for NotificationTemplate
- Exports/defines: DEFAULT_NOTIFICATION_TEMPLATES, NotificationTemplate, NotificationTemplateDoc
- Imported by: src/app/admin/notifications/page.tsx; src/app/api/admin/notifications/templates/[id]/route.ts; src/app/api/admin/notifications/templates/route.ts; src/lib/notifications/ensureDefaultTemplates.ts

#### `src/models/Payment.ts`
- Description: Mongoose model for Payment
- Exports/defines: Payment, PaymentDoc
- Imported by: src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/transactions/reports/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/payments/[id]/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/lib/notifications/adminActivity.ts; src/lib/payments/kashier.ts; src/lib/payments/kashierRefundReconciliation.ts; src/lib/payments/requestPaymentRecovery.ts; src/lib/payments/requestSettlement.ts; src/lib/payments/standaloneTripSettlement.ts; src/lib/requestGroupCancellation.ts; src/lib/services/standaloneTripExpiry.ts; src/lib/services/trips.ts

#### `src/models/PromoCode.ts`
- Description: Mongoose model for PromoCode
- Exports/defines: PromoCode, PromoCodeDoc
- Imported by: src/app/api/admin/promo-codes/[id]/route.ts; src/app/api/admin/promo-codes/route.ts; src/app/api/admin/waiting-list/route.ts; src/lib/promoCode.ts

#### `src/models/PromoCodeUsage.ts`
- Description: Mongoose model for PromoCodeUsage
- Exports/defines: PromoCodeUsage, PromoCodeUsageDoc
- Imported by: src/app/api/admin/promo-codes/[id]/logs/route.ts; src/lib/promoCode.ts

#### `src/models/PushSubscription.ts`
- Description: Mongoose model for PushSubscription
- Exports/defines: PushSubscription, PushSubscriptionDoc
- Imported by: src/app/api/push/subscriptions/route.ts; src/lib/notifications/webPush.ts

#### `src/models/Rating.ts`
- Description: Mongoose model for Rating
- Exports/defines: Rating, RatingDoc
- Imported by: src/app/api/trips/[id]/rating/route.ts; src/lib/services/trips.ts

#### `src/models/ReferralAuditLog.ts`
- Description: Mongoose model for ReferralAuditLog
- Exports/defines: ReferralAuditLog, ReferralAuditLogDoc
- Imported by: src/app/api/admin/referral-settings/history/route.ts; src/app/api/admin/users/[id]/referral-unlimited/route.ts; src/lib/referral.ts

#### `src/models/ReferralSettings.ts`
- Description: Mongoose model for ReferralSettings
- Exports/defines: REFERRAL_SETTINGS_ROLES, ReferralSettings, ReferralSettingsRole, ReferralSettingsDoc
- Imported by: src/app/api/admin/referral-settings/route.ts; src/lib/referral.ts

#### `src/models/ReferralUsage.ts`
- Description: Mongoose model for ReferralUsage
- Exports/defines: ReferralUsage, ReferralUsageDoc
- Imported by: src/app/admin/users/page.tsx; src/app/api/admin/referral/pending/route.ts; src/app/api/admin/users/route.ts; src/app/api/admin/users/search/route.ts; src/app/api/admin/users/unlimited/route.ts; src/app/api/referral/my-code/route.ts; src/lib/referral.ts

#### `src/models/RefundRequest.ts`
- Description: Mongoose model for RefundRequest
- Exports/defines: RefundRequest, RefundRequestDoc
- Imported by: src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/refund-requests/[id]/reject/route.ts; src/app/api/admin/refund-requests/route.ts; src/app/api/trips/[id]/cancel/route.ts

#### `src/models/Request.ts`
- Description: Mongoose model for Request
- Exports/defines: Request, RequestDoc
- Imported by: src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/trips/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/admin/waiting-list/count/route.ts; src/app/api/admin/waiting-list/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/expire/route.ts; src/app/api/trips/route.ts; src/app/my-requests/[id]/page.tsx; src/lib/notifications/adminActivity.ts; src/lib/payments/kashier.ts; src/lib/payments/kashierRefundReconciliation.ts; src/lib/payments/requestPaymentRecovery.ts; src/lib/payments/requestSettlement.ts; src/lib/payments/resolveBooking.ts; src/lib/promoCode.ts; src/lib/requestGroupCancellation.ts; src/lib/requestGroupCreation.ts; src/lib/services/requests.ts; src/lib/services/trips.ts

#### `src/models/Ride.ts`
- Description: Mongoose model for Ride
- Exports/defines: AssignedDriverSchema, Ride, RideDoc
- Imported by: src/app/admin/dashboard/page.tsx; src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/rides/[id]/route.ts; src/app/api/admin/rides/purge-today/route.ts; src/app/api/admin/rides/purge/route.ts; src/app/api/admin/rides/route.ts; src/app/api/admin/stats/route.ts; src/app/api/admin/trips/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/driver/rides/[id]/accept/route.ts; src/app/api/driver/rides/[id]/reject/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/lib/services/rideMatching.ts

#### `src/models/SecurityRateLimit.ts`
- Description: Mongoose model for SecurityRateLimit
- Exports/defines: SecurityRateLimit
- Imported by: src/lib/security/rateLimit.ts

#### `src/models/SmsOtp.ts`
- Description: Mongoose model for SmsOtp
- Exports/defines: SmsOtp
- Imported by: src/lib/auth/smsOtp.ts

#### `src/models/Station.ts`
- Description: Mongoose model for Station
- Exports/defines: Station, StationDoc
- Imported by: src/app/api/admin/availability/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/getPrivateRideRequests/route.ts; src/app/api/admin/station-datasets/[id]/preview/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts; src/app/api/admin/station-operations/summary/route.ts; src/app/api/admin/stations/matrix/route.ts; src/app/api/admin/stations/route.ts; src/app/api/driver/availability/route.ts; src/app/api/stations/[id]/route.ts; src/app/api/stations/route.ts; src/app/api/trips/route.ts; src/lib/services/availability.ts; src/lib/stations/publishDataset.ts

#### `src/models/StationAuditLog.ts`
- Description: Mongoose model for StationAuditLog
- Exports/defines: StationAuditLog, StationAuditLogDoc
- Imported by: src/app/api/admin/station-datasets/[id]/download/route.ts; src/app/api/admin/station-datasets/[id]/preview/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts; src/app/api/admin/station-datasets/from-file/route.ts; src/app/api/admin/station-datasets/upload/route.ts; src/app/api/admin/station-operations/audit/route.ts; src/app/api/stations/[id]/route.ts; src/app/api/stations/route.ts; src/lib/stations/publishDataset.ts

#### `src/models/StationDataset.ts`
- Description: Mongoose model for StationDataset
- Exports/defines: StationDataset, StationDatasetDoc
- Imported by: src/app/api/admin/station-datasets/[id]/download/route.ts; src/app/api/admin/station-datasets/[id]/preview/route.ts; src/app/api/admin/station-datasets/[id]/route.ts; src/app/api/admin/station-datasets/[id]/validate/route.ts; src/app/api/admin/station-datasets/from-file/route.ts; src/app/api/admin/station-datasets/history/route.ts; src/app/api/admin/station-datasets/upload/route.ts; src/app/api/admin/station-operations/summary/route.ts; src/lib/stations/publishDataset.ts

#### `src/models/StationOverride.ts`
- Description: Mongoose model for StationOverride
- Exports/defines: StationOverride
- Imported by: src/app/api/stations/[id]/route.ts; src/lib/stations/publishDataset.ts

#### `src/models/StationRegionState.ts`
- Description: Mongoose model for StationRegionState
- Exports/defines: StationRegionState
- Imported by: src/app/api/admin/station-operations/summary/route.ts; src/lib/stations/publishDataset.ts

#### `src/models/Trip.ts`
- Description: Mongoose model for Trip
- Exports/defines: PointSchema, StationSchema, StopSchema, Trip, TripDoc
- Imported by: src/app/admin/dashboard/page.tsx; src/app/api/actions/ride/[rideId]/route.ts; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/getPrivateRideRequests/route.ts; src/app/api/admin/getSharedRideRequests/route.ts; src/app/api/admin/match-ride/route.ts; src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/refund-requests/[id]/reject/route.ts; src/app/api/admin/refund-requests/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/shiftDates/route.ts; src/app/api/admin/stats/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/admin/trips/[id]/assign/route.ts; src/app/api/admin/trips/[id]/available-drivers/route.ts; src/app/api/admin/trips/[id]/route.ts; src/app/api/admin/trips/route.ts; src/app/api/admin/waiting-list/[id]/route.ts; src/app/api/admin/waiting-list/count/route.ts; src/app/api/admin/waiting-list/route.ts; src/app/api/driver/rides/[id]/accept/route.ts; src/app/api/driver/trips/[id]/complete/route.ts; src/app/api/logs/route.ts; src/app/api/logs/trip/[tripId]/route.ts; src/app/api/payments/session/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/trips/[id]/chat/route.ts; src/app/api/trips/[id]/rating/route.ts; src/app/api/trips/expire/route.ts; src/app/api/trips/route.ts; src/app/api/trips/spacing/route.ts; src/app/my-requests/[id]/page.tsx; src/lib/notifications/adminActivity.ts; src/lib/payments/kashier.ts; src/lib/payments/kashierRefundReconciliation.ts; src/lib/payments/requestPaymentRecovery.ts; src/lib/payments/requestSettlement.ts; src/lib/payments/resolveBooking.ts; src/lib/payments/standaloneTripSettlement.ts; src/lib/promoCode.ts; src/lib/requestGroupCancellation.ts; src/lib/services/logService.ts; src/lib/services/requests.ts; src/lib/services/standaloneTripExpiry.ts; src/lib/services/tripEarnings.ts; src/lib/services/trips.ts; src/models/Availability.ts; src/models/Ride.ts

#### `src/models/User.ts`
- Description: Mongoose model for User
- Exports/defines: User, UserDoc
- Imported by: src/app/admin/availability/page.tsx; src/app/admin/dashboard/page.tsx; src/app/admin/notifications/page.tsx; src/app/admin/transactions/[id]/page.tsx; src/app/admin/transactions/page.tsx; src/app/admin/users/page.tsx; src/app/api/admin/addMatchedData/route.ts; src/app/api/admin/drivers/[id]/wallet-settings/route.ts; src/app/api/admin/drivers/route.ts; src/app/api/admin/getDriverRequests/route.ts; src/app/api/admin/getMatchData/route.ts; src/app/api/admin/getPrivateRideRequests/route.ts; src/app/api/admin/getSharedRideRequests/route.ts; src/app/api/admin/login/route.ts; src/app/api/admin/match-ride/route.ts; src/app/api/admin/notifications/route.ts; src/app/api/admin/referral-campaigns/route.ts; src/app/api/admin/refund-requests/route.ts; src/app/api/admin/rides/[id]/reassign/route.ts; src/app/api/admin/rides/[id]/route.ts; src/app/api/admin/rides/route.ts; src/app/api/admin/settings/waiting-list/route.ts; src/app/api/admin/signup/route.ts; src/app/api/admin/stats/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/export/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/admin/trips/[id]/assign/route.ts; src/app/api/admin/trips/[id]/available-drivers/route.ts; src/app/api/admin/trips/route.ts; src/app/api/admin/users/[id]/referral-unlimited/route.ts; src/app/api/admin/users/[id]/reset-password/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/admin/users/route.ts; src/app/api/admin/users/search/route.ts; src/app/api/admin/users/unlimited/route.ts; src/app/api/admin/withdrawals/route.ts; src/app/api/auth/addresses/[id]/route.ts; src/app/api/auth/addresses/route.ts; src/app/api/auth/change-password/route.ts; src/app/api/auth/forgot-password/route.ts; src/app/api/auth/login/route.ts; src/app/api/auth/me/route.ts; src/app/api/auth/otp/request/route.ts; src/app/api/auth/otp/verify/route.ts; src/app/api/auth/register/route.ts; src/app/api/auth/security-question/route.ts; src/app/api/auth/security-question/setup/route.ts; src/app/api/auth/signUpDriver/route.ts; src/app/api/referral/my-code/route.ts; src/app/api/trips/route.ts; src/lib/middleware/adminAuth.ts; src/lib/notifications/adminActivity.ts; src/lib/referral.ts; src/lib/regions/resolveActiveRegion.ts; src/lib/services/profile.ts; src/lib/services/trips.ts

#### `src/models/Vehicle.ts`
- Description: Mongoose model for Vehicle
- Exports/defines: Vehicle, VehicleDoc
- Imported by: src/app/api/admin/vehicles/[key]/route.ts; src/app/api/admin/vehicles/route.ts; src/app/api/vehicles/[key]/route.ts; src/app/api/vehicles/route.ts; src/lib/db/getVehicles.ts; src/lib/db/seedVehicles.ts

#### `src/models/VehicleCatalogState.ts`
- Description: Mongoose model for VehicleCatalogState
- Exports/defines: VehicleCatalogState
- Imported by: src/lib/db/seedVehicles.ts

#### `src/models/Wallet.ts`
- Description: Mongoose model for Wallet
- Exports/defines: Wallet, WalletDoc
- Imported by: src/app/api/admin/drivers/[id]/wallet-settings/route.ts; src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/users/[id]/route.ts; src/app/api/admin/withdrawals/route.ts; src/app/api/referral/my-code/route.ts; src/lib/referral.ts; src/lib/wallet/wallet.ts

#### `src/models/WalletTransaction.ts`
- Description: Mongoose model for WalletTransaction
- Exports/defines: WalletTransaction, WalletTransactionDoc
- Imported by: src/app/api/admin/refund-requests/[id]/approve/route.ts; src/app/api/admin/transactions/[id]/route.ts; src/app/api/admin/transactions/export/route.ts; src/app/api/admin/transactions/refund/reconcile/route.ts; src/app/api/admin/transactions/refund/route.ts; src/app/api/admin/transactions/reports/route.ts; src/app/api/admin/transactions/route.ts; src/app/api/admin/transactions/timeseries/route.ts; src/app/api/payments/webhook/route.ts; src/app/api/trips/[id]/cancel/route.ts; src/app/api/wallet/route.ts; src/app/api/wallet/topup/route.ts; src/lib/payments/kashier.ts; src/lib/payments/kashierRefundReconciliation.ts; src/lib/payments/requestSettlement.ts; src/lib/payments/standaloneTripSettlement.ts; src/lib/referral.ts; src/lib/services/tripEarnings.ts; src/lib/wallet/wallet.ts

#### `src/models/WithdrawalRequest.ts`
- Description: Mongoose model for WithdrawalRequest
- Exports/defines: WithdrawalRequest, WithdrawalRequestDoc
- Imported by: src/app/api/admin/withdrawals/route.ts; src/app/api/wallet/withdraw/route.ts; src/lib/wallet/wallet.ts


### Types

#### `src/types/Ride.ts`
- Description: Type definitions for Ride
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `src/types/auth.ts`
- Description: Type definitions for auth
- Exports/defines: UserRole, SignInPayload, UserSignupPayload, DriverSignupPayload, AuthResponse, UserSignInPayload, UserSignUpPayload, DriverSignInPayload, DriverSignUpPayload, DriverSignupStep
- Imported by: none found

#### `src/types/booking.ts`
- Description: Type definitions for booking
- Exports/defines: PaymentStatus, BookingStatus, TripStatus, RideStatus, RidePassengerRow, RideRouteStopRow, RideListRow, RidePassengerDetail, RideRouteStopDetail, RideDetailView, TripListRow, BookingTripRow
- Imported by: src/app/api/requests/route.ts; src/app/api/trips/route.ts; src/app/my-trips/[id]/page.tsx; src/app/my-trips/history/page.tsx; src/app/my-trips/page.tsx; src/components/trips/DriverRideInteractiveClient.tsx; src/components/trips/NextTripCard.tsx; src/components/trips/VehicleSeatMap.tsx; src/lib/nextTrip.ts; src/lib/services/booking-status.ts; src/lib/services/requests.ts; src/lib/services/rideService.ts; src/lib/services/trips.ts

#### `src/types/custom-modules.d.ts`
- Description: Type definitions for custom-modules.d
- Exports/defines: default, Resend, nodemailer, t
- Imported by: none found

#### `src/types/driver.ts`
- Description: Type definitions for driver
- Exports/defines: RequestAction, RaiseOption, DriverCycleRequest, DriverProfile, DriverDocuments, DriverProfileMeData
- Imported by: src/components/map/PickupMap.tsx; src/components/map/PickupMapInner.tsx; src/components/map/PickupMapInnerOsm.tsx

#### `src/types/forms.ts`
- Description: Type definitions for forms
- Exports/defines: PassengerInput, StopInput, RouteLegInput, TripInput
- Imported by: src/app/api/trips/route.ts

#### `src/types/geo.ts`
- Description: Type definitions for geo
- Exports/defines: LatLng, GeoPoint, StationSelection
- Imported by: src/app/api/admin/availability/[id]/route.ts; src/app/api/admin/availability/route.ts; src/components/trips/DriverRideInteractiveClient.tsx; src/components/trips/PrivateRideDetails.tsx; src/components/trips/SharedRideDetails.tsx; src/lib/services/availability.ts; src/lib/services/requests.ts; src/lib/services/rideService.ts; src/lib/services/trips.ts; src/types/booking.ts; src/types/forms.ts

#### `src/types/log.ts`
- Description: Type definitions for log
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `src/types/shared.ts`
- Description: Type definitions for shared
- Exports/defines: SEAT_COSTS, SEAT_LABELS, PRIVATE_SEAT_LABELS, RideType, GenderPref, WalkMinutes, TripType, WeekDay, GroupType, GroupAction, RequestStatus, SeatId
- Imported by: src/app/profile/DriverProfileClient.tsx; src/app/profile/ProfileClient.tsx; src/components/create/CreateClient.tsx; src/components/create/TripCycle.tsx; src/components/landing/AddressInput.tsx; src/components/shared/SavedAddressesSection.tsx; src/lib/services/profile.ts; src/lib/useMapState.ts; src/types/driver.ts; src/types/user.ts

#### `src/types/user.ts`
- Description: Type definitions for user
- Exports/defines: GenderPreference, InteractionLevel, MusicPreference, WalkingDistancePref, AirConditioningPref, NotificationType, CommutePreferences, UserRequest, CoPassenger, UserProfile, RelatedPassenger, PassengerPayload
- Imported by: src/components/shared/StatusPill.tsx


### Scripts

#### `scripts/audit-operational-regions.cjs`
- Description: Maintenance script for audit-operational-regions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/audit-request-groups.mjs`
- Description: Maintenance script for audit-request-groups
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/audit-station-region-migration.cjs`
- Description: Maintenance script for audit-station-region-migration
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/audit-station-regions.cjs`
- Description: Maintenance script for audit-station-regions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/audit-user-regions.cjs`
- Description: Maintenance script for audit-user-regions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-admin-permissions.cjs`
- Description: Maintenance script for backfill-admin-permissions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-kashier-payment-ledger.cjs`
- Description: Maintenance script for backfill-kashier-payment-ledger
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-operational-regions.cjs`
- Description: Maintenance script for backfill-operational-regions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-public-numbers.cjs`
- Description: Maintenance script for backfill-public-numbers
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-station-regions.cjs`
- Description: Maintenance script for backfill-station-regions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-user-regions.cjs`
- Description: Maintenance script for backfill-user-regions
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/backfill-wallet-reserved.cjs`
- Description: Maintenance script for backfill-wallet-reserved
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/checkLegacyRequests.mjs`
- Description: Maintenance script for checkLegacyRequests
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/check_referrals.ts`
- Description: Maintenance script for check_referrals
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/debug-import-workbook.cjs`
- Description: Maintenance script for debug-import-workbook
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/ensureIndexes.mjs`
- Description: Maintenance script for ensureIndexes
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/migrate-promo-code-discount-type.cjs`
- Description: Maintenance script for migrate-promo-code-discount-type
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/migrate-referral-balance-bonuses.cjs`
- Description: Maintenance script for migrate-referral-balance-bonuses
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/seed-prod-data.cjs`
- Description: Maintenance script for seed-prod-data
- Exports/defines: module.exports
- Imported by: scripts/seed-prod-data.test.cjs

#### `scripts/seed-prod-data.test.cjs`
- Description: Maintenance script for seed-prod-data.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/seed-stations.cjs`
- Description: Maintenance script for seed-stations
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/seed_vehicles.js`
- Description: Maintenance script for seed_vehicles
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/sync-payment-indexes.cjs`
- Description: Maintenance script for sync-payment-indexes
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `scripts/test_signUpDriver.js`
- Description: Maintenance script for test_signUpDriver
- Exports/defines: No explicit exports detected
- Imported by: none found


### Tests

#### `tests/auditRequestGroups.test.mjs`
- Description: Test suite for auditRequestGroups.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/availability.test.mjs`
- Description: Test suite for availability.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/countdown.test.mjs`
- Description: Test suite for countdown.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/groupRequestTrips.test.mjs`
- Description: Test suite for groupRequestTrips.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/multi-region.test.mjs`
- Description: Test suite for multi-region.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/multiDayBooking.test.mjs`
- Description: Test suite for multiDayBooking.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/multiDayRollout.test.mjs`
- Description: Test suite for multiDayRollout.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/nextTrip.test.mjs`
- Description: Test suite for nextTrip.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/notificationHref.test.mjs`
- Description: Test suite for notificationHref.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/phase8bGuards.test.mjs`
- Description: Test suite for phase8bGuards.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/pricing.test.mjs`
- Description: Test suite for pricing.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/promoUsageRelease.test.mjs`
- Description: Test suite for promoUsageRelease.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/register-next-server-hook.mjs`
- Description: Test suite for register-next-server-hook
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/rejectionDisplay.test.mjs`
- Description: Test suite for rejectionDisplay.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestCreationDisabled.test.mjs`
- Description: Test suite for requestCreationDisabled.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestGroupCancellation.test.mjs`
- Description: Test suite for requestGroupCancellation.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestGroupCreation.test.mjs`
- Description: Test suite for requestGroupCreation.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestGroupLifecycleVerification.test.mjs`
- Description: Test suite for requestGroupLifecycleVerification.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestPaymentRecoveryDecision.test.mjs`
- Description: Test suite for requestPaymentRecoveryDecision.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestPaymentState.test.mjs`
- Description: Test suite for requestPaymentState.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestPromoRelease.test.mjs`
- Description: Test suite for requestPromoRelease.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/requestSettlement.test.mjs`
- Description: Test suite for requestSettlement.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/security-request.test.mjs`
- Description: Test suite for security-request.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/sharedRideStepper.test.mjs`
- Description: Test suite for sharedRideStepper.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/standaloneTripCancellation.test.mjs`
- Description: Test suite for standaloneTripCancellation.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/standaloneTripExpiry.test.mjs`
- Description: Test suite for standaloneTripExpiry.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/statusDisplay.test.mjs`
- Description: Test suite for statusDisplay.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripBatchCreation.test.mjs`
- Description: Test suite for tripBatchCreation.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripBooking.test.mjs`
- Description: Test suite for tripBooking.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripHistory.test.mjs`
- Description: Test suite for tripHistory.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripHistoryFilters.test.mjs`
- Description: Test suite for tripHistoryFilters.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripPayments.test.mjs`
- Description: Test suite for tripPayments.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripSpacing.test.mjs`
- Description: Test suite for tripSpacing.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripTabView.test.mjs`
- Description: Test suite for tripTabView.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/tripTabs.test.mjs`
- Description: Test suite for tripTabs.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/waiting-list-admin.test.mjs`
- Description: Test suite for waiting-list-admin.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/waiting-list-hardening.test.mjs`
- Description: Test suite for waiting-list-hardening.test
- Exports/defines: No explicit exports detected
- Imported by: none found

#### `tests/walletReserveWithdrawal.test.mjs`
- Description: Test suite for walletReserveWithdrawal.test
- Exports/defines: No explicit exports detected
- Imported by: none found


### Config

#### `eslint.config.mjs`
- Description: Configuration for eslint.config
- Exports/defines: default, eslintConfig
- Imported by: none found

#### `next.config.ts`
- Description: Configuration for next.config
- Exports/defines: default, nextConfig
- Imported by: none found

#### `postcss.config.mjs`
- Description: Configuration for postcss.config
- Exports/defines: default, config
- Imported by: none found


### Misc

#### `next-env.d.ts`
- Description: Source file: next-env.d
- Exports/defines: No explicit exports detected
- Imported by: none found


## 4) Entry points and route registration

- Backend/server start: `package.json` uses `next dev`, `next build`, and `next start`; no custom Node server bootstraps were found.
- Route registration: automatic file-system routing via `src/app/**` and `src/app/api/**/route.ts` files; no central router registry is used.
- Frontend root app: `src/app/layout.tsx` and `src/app/page.tsx` are the main app entry points.
- Main pages: `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/create/page.tsx`, `src/app/profile/page.tsx`, `src/app/my-requests/page.tsx`, `src/app/my-trips/page.tsx`, `src/app/admin/page.tsx`, `src/app/availability/page.tsx`, `src/app/activity/page.tsx`, `src/app/ride-requests/page.tsx`, `src/app/wallet/page.tsx`.

## 5) Existing tests, linters, and tooling

- Linting: `eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; script: `npm run lint` -> `eslint`.
- Testing: `npm test` runs `node --import ./tests/register-next-server-hook.mjs --test tests/*.test.mjs` using the built-in Node test runner.
- Project includes many test files under `tests/**` and maintenance scripts under `scripts/**` for migrations, seed tasks, and data audits.
- Build toolchain: Next.js + Tailwind + TypeScript + PostCSS (`postcss.config.mjs`, `next.config.ts`, `tsconfig.json`).
