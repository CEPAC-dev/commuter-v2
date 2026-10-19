# API Authentication Audit

Scope: all 184 `route.ts` files and 241 exported route handlers under `src/app/api`. The route table records every method individually in the Methods cell, including its exported-handler line. PII Y means personal, contact, trip/location, chat/support, or payment data may be processed or returned; PII N means none apparent. This is a source audit, not a penetration test.

Auth codes: `ADM` = admin session/role; `SES` = signed-in session with role/ownership checks; `MIX` = account session or validated guest token; `PUB` = intended public endpoint; `INVITE` = invite-secret-gated enrollment; `SIGNED` = signed share token; `CRON` = cron secret/admin; `SIG` = verified payment webhook signature. All admin table routes inherit ADM except login/signup, as noted. `adminAuth` checks session and admin role (`src/lib/middleware/adminAuth.ts:34-46`); the session helper is in `src/lib/auth/session.ts:52`.

Handler counts: ADM 125, SES 88, MIX 4, PUB 19, INVITE 1, SIGNED 1, CRON 1, SIG 1, and NONE 1. The lone NONE method is `GET /api/trips/expire`, which returns 405 without reading or mutating data; POST uses CRON.

## Admin routes

All handlers below are `ADM`, except `/api/admin/login` (`PUB` login) and `/api/admin/signup` (`INVITE`). Read/write effects and exposure are stated per route; method-specific line references are given.

| Route | Method(s) | Reads / writes; personal-data exposure |
|---|---|---|
| `/api/admin/activity-notifications` | GET@8; PATCH@71 | Read/admin activity notifications; mark/update notification state. **PII Y**. [src/app/api/admin/activity-notifications/route.ts:8,71] |
| `/api/admin/addMatchedData` | POST@791 | Write ride-match data. **PII Y**. [src/app/api/admin/addMatchedData/route.ts:791] |
| `/api/admin/availability` | GET@27; POST@50 | Read/create driver availability. **PII Y**. [src/app/api/admin/availability/route.ts:27,50] |
| `/api/admin/availability/[id]` | GET@14; PATCH@27; DELETE@67 | Read/update/delete availability. **PII Y**. [src/app/api/admin/availability/[id]/route.ts:14,27,67] |
| `/api/admin/availability/export` | GET@6 | Export availability. **PII Y**. [src/app/api/admin/availability/export/route.ts:6] |
| `/api/admin/availability/restore` | POST@11 | Restore availability data. **PII Y**. [src/app/api/admin/availability/restore/route.ts:11] |
| `/api/admin/chat-reports` | GET@30 | Read reported chats. **PII Y**. [src/app/api/admin/chat-reports/route.ts:30] |
| `/api/admin/chat-reports/[id]` | PATCH@12 | Update/report review state. **PII Y**. [src/app/api/admin/chat-reports/[id]/route.ts:12] |
| `/api/admin/drivers` | GET@7 | Read driver data. **PII Y**. [src/app/api/admin/drivers/route.ts:7] |
| `/api/admin/drivers/no-shows` | GET@19 | Read driver no-show data. **PII Y**. [src/app/api/admin/drivers/no-shows/route.ts:19] |
| `/api/admin/drivers/[id]/wallet-settings` | PATCH@8 | Update driver wallet settings. **PII Y**. [src/app/api/admin/drivers/[id]/wallet-settings/route.ts:8] |
| `/api/admin/getDriverRequests` | GET@62 | Read driver requests/matching inputs. **PII Y**. [src/app/api/admin/getDriverRequests/route.ts:62] |
| `/api/admin/getMatchData` | GET@337 | Read matching data. **PII Y**. [src/app/api/admin/getMatchData/route.ts:337] |
| `/api/admin/getPrivateRideRequests` | GET@105 | Read private-ride requests. **PII Y**. [src/app/api/admin/getPrivateRideRequests/route.ts:105] |
| `/api/admin/getSharedRideRequests` | GET@54 | Read shared-ride requests. **PII Y**. [src/app/api/admin/getSharedRideRequests/route.ts:54] |
| `/api/admin/incidents` | GET@9 | Read incident reports. **PII Y**. [src/app/api/admin/incidents/route.ts:9] |
| `/api/admin/incidents/[id]` | GET@58 | Read incident detail. **PII Y**. [src/app/api/admin/incidents/[id]/route.ts:58] |
| `/api/admin/incidents/[id]/resolve` | POST@110 | Resolve incident. **PII Y**. [src/app/api/admin/incidents/[id]/resolve/route.ts:110] |
| `/api/admin/login` | POST@12 | Authenticate admin credentials/create session. **PII Y** (credential input; not an unauthenticated data endpoint). [src/app/api/admin/login/route.ts:12] |
| `/api/admin/maps` | GET@49; PUT@85 | Read/update map configuration. **PII N**. [src/app/api/admin/maps/route.ts:49,85] |
| `/api/admin/match-ride` | GET@9 | Read matching/ride data. **PII Y**. [src/app/api/admin/match-ride/route.ts:9] |
| `/api/admin/notifications` | GET@53; POST@186 | Read/send admin notifications. **PII Y**. [src/app/api/admin/notifications/route.ts:53,186] |
| `/api/admin/notifications/templates` | GET@23; POST@34 | Read/create notification templates. **PII N**. [src/app/api/admin/notifications/templates/route.ts:23,34] |
| `/api/admin/notifications/templates/[id]` | PATCH@7; DELETE@43 | Update/delete notification template. **PII N**. [src/app/api/admin/notifications/templates/[id]/route.ts:7,43] |
| `/api/admin/promo-codes` | GET@12; POST@46 | Read/create promo codes. **PII N**. [src/app/api/admin/promo-codes/route.ts:12,46] |
| `/api/admin/promo-codes/[id]` | PATCH@11; DELETE@205 | Update/delete promo code. **PII N**. [src/app/api/admin/promo-codes/[id]/route.ts:11,205] |
| `/api/admin/promo-codes/[id]/logs` | GET@7 | Read promo-code use/log data. **PII Y**. [src/app/api/admin/promo-codes/[id]/logs/route.ts:7] |
| `/api/admin/referral-campaigns` | GET@62; PUT@138 | Read/update referral campaigns. **PII N**. [src/app/api/admin/referral-campaigns/route.ts:62,138] |
| `/api/admin/referral-settings` | GET@27; PUT@36 | Read/update referral settings. **PII N**. [src/app/api/admin/referral-settings/route.ts:27,36] |
| `/api/admin/referral-settings/history` | GET@6 | Read settings history. **PII N**. [src/app/api/admin/referral-settings/history/route.ts:6] |
| `/api/admin/referral/pending` | GET@6 | Read pending referral activity. **PII Y**. [src/app/api/admin/referral/pending/route.ts:6] |
| `/api/admin/referral/reconcile` | POST@5 | Reconcile referral data. **PII Y**. [src/app/api/admin/referral/reconcile/route.ts:5] |
| `/api/admin/referral/[referralUsageId]/reconcile` | POST@5 | Reconcile a referral record. **PII Y**. [src/app/api/admin/referral/[referralUsageId]/reconcile/route.ts:5] |
| `/api/admin/refund-requests` | GET@8 | Read refund requests, passenger/trip details. **PII Y**. [src/app/api/admin/refund-requests/route.ts:8] |
| `/api/admin/refund-requests/[id]/approve` | POST@20 | Approve refund. **PII Y**. [src/app/api/admin/refund-requests/[id]/approve/route.ts:20] |
| `/api/admin/refund-requests/[id]/reject` | POST@8 | Reject refund. **PII Y**. [src/app/api/admin/refund-requests/[id]/reject/route.ts:8] |
| `/api/admin/rides` | GET@41; DELETE@132 | Read/delete rides. **PII Y**. [src/app/api/admin/rides/route.ts:41,132] |
| `/api/admin/rides/purge` | DELETE@37 | Purge rides. **PII Y**. [src/app/api/admin/rides/purge/route.ts:37] |
| `/api/admin/rides/purge-today` | DELETE@56 | Purge today’s rides. **PII Y**. [src/app/api/admin/rides/purge-today/route.ts:56] |
| `/api/admin/rides/[id]` | GET@16; PATCH@115; DELETE@186 | Read/update/delete ride. **PII Y**. [src/app/api/admin/rides/[id]/route.ts:16,115,186] |
| `/api/admin/rides/[id]/reassign` | PATCH@19 | Reassign ride. **PII Y**. [src/app/api/admin/rides/[id]/reassign/route.ts:19] |
| `/api/admin/settings` | GET@8; PUT@23 | Read/update operational settings. **PII N**. [src/app/api/admin/settings/route.ts:8,23] |
| `/api/admin/settings/waiting-list` | GET@36; PATCH@44 | Read/update waiting-list setting. **PII N**. [src/app/api/admin/settings/waiting-list/route.ts:36,44] |
| `/api/admin/shiftDates` | POST@11 | Mutate shift-date data. **PII Y**. [src/app/api/admin/shiftDates/route.ts:11] |
| `/api/admin/signup` | POST@20 | Create admin account; requires configured invite code. **PII Y** (input/account data). [src/app/api/admin/signup/route.ts:20] |
| `/api/admin/sms/balance` | GET@5 | Read SMS-service balance. **PII N**. [src/app/api/admin/sms/balance/route.ts:5] |
| `/api/admin/station-datasets/from-file` | POST@12 | Import station dataset. **PII N**. [src/app/api/admin/station-datasets/from-file/route.ts:12] |
| `/api/admin/station-datasets/history` | GET@6 | Read dataset history. **PII N**. [src/app/api/admin/station-datasets/history/route.ts:6] |
| `/api/admin/station-datasets/upload` | POST@23 | Upload dataset. **PII N**. [src/app/api/admin/station-datasets/upload/route.ts:23] |
| `/api/admin/station-datasets/[id]` | GET@7 | Read dataset. **PII N**. [src/app/api/admin/station-datasets/[id]/route.ts:7] |
| `/api/admin/station-datasets/[id]/download` | GET@11 | Download dataset. **PII N**. [src/app/api/admin/station-datasets/[id]/download/route.ts:11] |
| `/api/admin/station-datasets/[id]/preview` | GET@10 | Preview dataset. **PII N**. [src/app/api/admin/station-datasets/[id]/preview/route.ts:10] |
| `/api/admin/station-datasets/[id]/publish` | POST@7 | Publish dataset. **PII N**. [src/app/api/admin/station-datasets/[id]/publish/route.ts:7] |
| `/api/admin/station-datasets/[id]/rollback` | POST@7 | Roll back dataset. **PII N**. [src/app/api/admin/station-datasets/[id]/rollback/route.ts:7] |
| `/api/admin/station-datasets/[id]/validate` | POST@15 | Validate dataset. **PII N**. [src/app/api/admin/station-datasets/[id]/validate/route.ts:15] |
| `/api/admin/station-files` | GET@27; DELETE@33 | Read/delete station files. **PII N**. [src/app/api/admin/station-files/route.ts:27,33] |
| `/api/admin/station-operations/audit` | GET@7 | Read station audit records. **PII N** (operator IDs may be present). [src/app/api/admin/station-operations/audit/route.ts:7] |
| `/api/admin/station-operations/summary` | GET@9 | Read station operations summary. **PII N**. [src/app/api/admin/station-operations/summary/route.ts:9] |
| `/api/admin/station-suggestions` | GET@21 | Read station suggestions/requesters. **PII Y**. [src/app/api/admin/station-suggestions/route.ts:21] |
| `/api/admin/station-suggestions/[id]` | GET@37; PATCH@62 | Read/update suggestion. **PII Y**. [src/app/api/admin/station-suggestions/[id]/route.ts:37,62] |
| `/api/admin/stations` | GET@7 | Read station data. **PII N**. [src/app/api/admin/stations/route.ts:7] |
| `/api/admin/stations/matrix` | GET@63 | Read station matrix. **PII N**. [src/app/api/admin/stations/matrix/route.ts:63] |
| `/api/admin/stats` | GET@13 | Read aggregate statistics. **PII N**. [src/app/api/admin/stats/route.ts:13] |
| `/api/admin/support` | GET@9 | Read support conversations. **PII Y**. [src/app/api/admin/support/route.ts:9] |
| `/api/admin/support/unread` | GET@7 | Read support unread counts. **PII Y**. [src/app/api/admin/support/unread/route.ts:7] |
| `/api/admin/support/[id]` | GET@15; PATCH@72 | Read/update support conversation. **PII Y**. [src/app/api/admin/support/[id]/route.ts:15,72] |
| `/api/admin/support/[id]/messages` | POST@13 | Write support message. **PII Y**. [src/app/api/admin/support/[id]/messages/route.ts:13] |
| `/api/admin/transactions` | GET@175 | Read transactions. **PII Y**. [src/app/api/admin/transactions/route.ts:175] |
| `/api/admin/transactions/export` | GET@37 | Export transactions. **PII Y**. [src/app/api/admin/transactions/export/route.ts:37] |
| `/api/admin/transactions/refund` | POST@30 | Issue/refund transaction. **PII Y**. [src/app/api/admin/transactions/refund/route.ts:30] |
| `/api/admin/transactions/refund/reconcile` | POST@18 | Reconcile refund transactions. **PII Y**. [src/app/api/admin/transactions/refund/reconcile/route.ts:18] |
| `/api/admin/transactions/reports` | GET@16 | Read transaction reports. **PII Y**. [src/app/api/admin/transactions/reports/route.ts:16] |
| `/api/admin/transactions/timeseries` | GET@11 | Read transaction time series. **PII Y**. [src/app/api/admin/transactions/timeseries/route.ts:11] |
| `/api/admin/transactions/[id]` | GET@15 | Read transaction detail. **PII Y**. [src/app/api/admin/transactions/[id]/route.ts:15] |
| `/api/admin/trips` | GET@48; DELETE@154 | Read/delete trips. **PII Y**. [src/app/api/admin/trips/route.ts:48,154] |
| `/api/admin/trips/[id]` | GET@6; DELETE@33 | Read/delete trip. **PII Y**. [src/app/api/admin/trips/[id]/route.ts:6,33] |
| `/api/admin/trips/[id]/assign` | PATCH@9 | Assign trip. **PII Y**. [src/app/api/admin/trips/[id]/assign/route.ts:9] |
| `/api/admin/trips/[id]/available-drivers` | GET@8 | Read available drivers. **PII Y**. [src/app/api/admin/trips/[id]/available-drivers/route.ts:8] |
| `/api/admin/users` | GET@7 | Read users. **PII Y**. [src/app/api/admin/users/route.ts:7] |
| `/api/admin/users/search` | GET@8 | Search users. **PII Y**. [src/app/api/admin/users/search/route.ts:8] |
| `/api/admin/users/unlimited` | GET@8 | Read user referral/unlimited status. **PII Y**. [src/app/api/admin/users/unlimited/route.ts:8] |
| `/api/admin/users/[id]` | GET@13; PATCH@34; DELETE@130 | Read/update/delete user. **PII Y**. [src/app/api/admin/users/[id]/route.ts:13,34,130] |
| `/api/admin/users/[id]/referral-unlimited` | PATCH@8 | Update referral limit. **PII Y**. [src/app/api/admin/users/[id]/referral-unlimited/route.ts:8] |
| `/api/admin/users/[id]/reset-password` | POST@9 | Reset user password. **PII Y**. [src/app/api/admin/users/[id]/reset-password/route.ts:9] |
| `/api/admin/vehicles` | GET@9; POST@17 | Read/create vehicle configuration. **PII N**. [src/app/api/admin/vehicles/route.ts:9,17] |
| `/api/admin/vehicles/[key]` | PATCH@15; DELETE@31 | Update/delete vehicle configuration. **PII N**. [src/app/api/admin/vehicles/[key]/route.ts:15,31] |
| `/api/admin/waiting-list` | GET@23 | Read waiting-list entries. **PII Y**. [src/app/api/admin/waiting-list/route.ts:23] |
| `/api/admin/waiting-list/count` | GET@10 | Read waiting-list count. **PII N**. [src/app/api/admin/waiting-list/count/route.ts:10] |
| `/api/admin/waiting-list/[id]` | PATCH@46 | Update waiting-list entry. **PII Y**. [src/app/api/admin/waiting-list/[id]/route.ts:46] |
| `/api/admin/wallets/[driverId]/adjust` | POST@20 | Adjust driver wallet. **PII Y**. [src/app/api/admin/wallets/[driverId]/adjust/route.ts:20] |
| `/api/admin/withdrawals` | GET@9 | Read withdrawals, driver contact and wallet data. **PII Y**. [src/app/api/admin/withdrawals/route.ts:9] |
| `/api/admin/withdrawals/[id]/approve` | POST@5 | Approve withdrawal. **PII Y**. [src/app/api/admin/withdrawals/[id]/approve/route.ts:5] |
| `/api/admin/withdrawals/[id]/reject` | POST@5 | Reject withdrawal. **PII Y**. [src/app/api/admin/withdrawals/[id]/reject/route.ts:5] |

## Other API routes

| Route | Method(s) | Authentication; reads / writes; personal-data exposure |
|---|---|---|
| `/api/actions` | GET@1 | `PUB`; health response only; **PII N**. [src/app/api/actions/route.ts:1] |
| `/api/actions/ride/[rideId]` | GET@449; POST@685 | `SES` + ride-driver ownership; read next action / write ride action; **PII Y**. [src/app/api/actions/ride/[rideId]/route.ts:449,685] |
| `/api/actions/ride/[rideId]/incident` | POST@36 | `SES`; create incident; **PII Y**. [src/app/api/actions/ride/[rideId]/incident/route.ts:36] |
| `/api/actions/ride/[rideId]/incident/withdraw` | POST@25 | `SES`; withdraw incident; **PII Y**. [src/app/api/actions/ride/[rideId]/incident/withdraw/route.ts:25] |
| `/api/auth/addresses` | GET@10; POST@23 | `SES`; read/create saved addresses; **PII Y**. [src/app/api/auth/addresses/route.ts:10,23] |
| `/api/auth/addresses/[id]` | PATCH@11; DELETE@71 | `SES` + address owner; update/delete saved address; **PII Y**. [src/app/api/auth/addresses/[id]/route.ts:11,71] |
| `/api/auth/change-password` | POST@19 | `SES`; change password; **PII Y** (account credential). [src/app/api/auth/change-password/route.ts:19] |
| `/api/auth/forgot-password` | POST@19 | `PUB` recovery flow with account verification; reads/updates account credential; **PII Y**. [src/app/api/auth/forgot-password/route.ts:19] |
| `/api/auth/login` | POST@14 | `PUB` credential login; reads account and creates session; **PII Y** (credentials/account). [src/app/api/auth/login/route.ts:14] |
| `/api/auth/logout` | POST@5 | `SES`; clear session; **PII N**. [src/app/api/auth/logout/route.ts:5] |
| `/api/auth/me` | GET@14; PATCH@26 | `SES`; read/update own profile; **PII Y**. [src/app/api/auth/me/route.ts:14,26] |
| `/api/auth/otp/request` | POST@22 | `PUB` or `SES` depending on purpose; request OTP; **PII Y** (phone/account). [src/app/api/auth/otp/request/route.ts:22] |
| `/api/auth/otp/verify` | POST@9 | `PUB` OTP verification / session-dependent phone verification; **PII Y**. [src/app/api/auth/otp/verify/route.ts:9] |
| `/api/auth/register` | POST@29 | `PUB`; create passenger account; **PII Y**. [src/app/api/auth/register/route.ts:29] |
| `/api/auth/security-question` | POST@13 | `PUB` account-recovery question lookup; **PII Y** (account lookup). [src/app/api/auth/security-question/route.ts:13] |
| `/api/auth/security-question/setup` | POST@14 | `SES`/recovery-reset session; configure security question; **PII Y**. [src/app/api/auth/security-question/setup/route.ts:14] |
| `/api/auth/signUpDriver` | POST@34 | `PUB`; create driver account; **PII Y**. [src/app/api/auth/signUpDriver/route.ts:34] |
| `/api/auth/verification-config` | GET@5 | `PUB`; read public verification method/questions; **PII N**. [src/app/api/auth/verification-config/route.ts:5] |
| `/api/bookings/[id]/status` | GET@5 | `SES` + caller’s booking; read booking status; **PII Y**. [src/app/api/bookings/[id]/status/route.ts:5] |
| `/api/chat/unread` | GET@16 | `SES`; read caller’s unread chat counts; **PII Y** (trip/chat metadata). [src/app/api/chat/unread/route.ts:16] |
| `/api/contact` | POST@4 | `PUB`; submit contact name/email/message; **PII Y input**, but no account-data response. [src/app/api/contact/route.ts:4] |
| `/api/directions` | GET@501 | `SES`; read route directions; **PII N**. [src/app/api/directions/route.ts:501-503] |
| `/api/driver/availability` | GET@21; DELETE@31; PUT@51 | `SES` + driver role/own records; read/write availability; **PII Y**. [src/app/api/driver/availability/route.ts:21,31,51] |
| `/api/driver/availability/[id]` | DELETE@6 | `SES` + driver ownership; delete availability; **PII Y**. [src/app/api/driver/availability/[id]/route.ts:6] |
| `/api/driver/rides/[id]/accept` | POST@9 | `SES` + driver role; accept ride; **PII Y**. [src/app/api/driver/rides/[id]/accept/route.ts:9] |
| `/api/driver/rides/[id]/reject` | POST@7 | `SES` + driver role; reject ride; **PII Y**. [src/app/api/driver/rides/[id]/reject/route.ts:7] |
| `/api/driver/submit-review` | POST@51 | `SES`; submit driver review; **PII Y**. [src/app/api/driver/submit-review/route.ts:51] |
| `/api/driver/trips` | GET@5 | `SES` + driver role; read own trips; **PII Y**. [src/app/api/driver/trips/route.ts:5] |
| `/api/driver/trips/[id]/complete` | POST@11 | `SES` + driver role/ownership; complete trip; **PII Y**. [src/app/api/driver/trips/[id]/complete/route.ts:11] |
| `/api/driver/trips/[id]/start` | POST@8 | `SES` + driver role/ownership; start trip; **PII Y**. [src/app/api/driver/trips/[id]/start/route.ts:8] |
| `/api/geocode/reverse` | GET@3 | `PUB`; reverse geocoding; **PII N**. [src/app/api/geocode/reverse/route.ts:3] |
| `/api/live/[token]` | GET@35 | `SIGNED`; validate signed live-share token; read shared trip/location data; **PII Y** by intentional share. [src/app/api/live/[token]/route.ts:35-40] |
| `/api/logs` | GET@20; POST@89 | GET `ADM`; POST `SES` + trip ownership; read/write trip logs; **PII Y**. [src/app/api/logs/route.ts:20,89] |
| `/api/logs/[logId]` | GET@11; DELETE@57 | GET `SES` + owner/admin scoping; DELETE `ADM`; read/delete logs; **PII Y**. [src/app/api/logs/[logId]/route.ts:11,57] |
| `/api/logs/driver/[driverId]` | GET@13 | `SES`; admin or matching driver; read driver logs; **PII Y**. [src/app/api/logs/driver/[driverId]/route.ts:13] |
| `/api/logs/trip/[tripId]` | GET@14 | `SES`; admin or trip participant; read trip logs; **PII Y**. [src/app/api/logs/trip/[tripId]/route.ts:14] |
| `/api/logs/user/[userId]` | GET@13 | `SES`; admin or matching user; read user logs; **PII Y**. [src/app/api/logs/user/[userId]/route.ts:13] |
| `/api/notifications` | GET@8 | `SES`; read caller’s notifications; **PII Y**. [src/app/api/notifications/route.ts:8] |
| `/api/notifications/read-all` | POST@6; PATCH@21 | Both export the same session-guarded read-all handler; mark caller’s notifications read; **PII Y**. [src/app/api/notifications/read-all/route.ts:6,21] |
| `/api/notifications/unread` | GET@6 | `SES`; read caller’s unread count; **PII Y**. [src/app/api/notifications/unread/route.ts:6] |
| `/api/notifications/[id]` | PATCH@7 | `SES` + notification owner; update notification; **PII Y**. [src/app/api/notifications/[id]/route.ts:7] |
| `/api/notifications/[id]/read` | PATCH@7 | `SES` + notification owner; mark read; **PII Y**. [src/app/api/notifications/[id]/read/route.ts:7] |
| `/api/ors` | POST@6 | `PUB`; route service proxy; **PII N**. [src/app/api/ors/route.ts:6] |
| `/api/payments/session` | POST@154 | `SES` + payable-booking ownership; create payment session; **PII Y**. [src/app/api/payments/session/route.ts:154,158-177] |
| `/api/payments/verify` | POST@7 | `SES` + caller’s payment; verify/settle booking; **PII Y**. [src/app/api/payments/verify/route.ts:7,11-27] |
| `/api/payments/wallet` | POST@10 | Delegates to payment-session endpoint and forwards request cookie; **SES**; payment/wallet action; **PII Y**. [src/app/api/payments/wallet/route.ts:10,14-25] |
| `/api/payments/webhook` | POST@86 | `SIG`; verifies webhook signature before processing payment events; **PII Y** payment records. [src/app/api/payments/webhook/route.ts:86,116-140] |
| `/api/payments/[id]` | GET@7 | `SES` + payment owner; read payment; **PII Y**. [src/app/api/payments/[id]/route.ts:7,11-23] |
| `/api/places/autocomplete` | GET@3 | `PUB`; place autocomplete; **PII N**. [src/app/api/places/autocomplete/route.ts:3] |
| `/api/places/details` | GET@15 | `PUB`; place details; **PII N**. [src/app/api/places/details/route.ts:15] |
| `/api/promo-codes/validate` | POST@5 | `SES`; validate code for caller; **PII Y** (account-associated validation). [src/app/api/promo-codes/validate/route.ts:5-6] |
| `/api/push/subscriptions` | GET@29; POST@40; DELETE@84 | `SES`; read/create/delete caller’s push subscription; **PII Y** (subscription/device endpoint). [src/app/api/push/subscriptions/route.ts:29,40,84] |
| `/api/push/vapid-public-key` | GET@4 | `PUB`; return public push key; **PII N**. [src/app/api/push/vapid-public-key/route.ts:4] |
| `/api/referral/my-code` | GET@12 | `SES`; read caller’s referral code/status; **PII Y**. [src/app/api/referral/my-code/route.ts:12-18] |
| `/api/requests` | GET@27 | `SES`; read caller’s requests; **PII Y**. [src/app/api/requests/route.ts:27-47] |
| `/api/requests/[id]` | GET@6 | `SES` + request owner; read request; **PII Y**. [src/app/api/requests/[id]/route.ts:6,10-19] |
| `/api/requests/[id]/cancel` | POST@13 | `SES` + request owner; cancel request; **PII Y**. [src/app/api/requests/[id]/cancel/route.ts:13,17-49] |
| `/api/ride` | POST@27; GET@48 | `SES`/role-scoped; create/list rides; **PII Y**. [src/app/api/ride/route.ts:27,48] |
| `/api/ride/[id]` | GET@17; PATCH@49; DELETE@88 | `SES` + ride ownership/role; read/update/cancel ride; **PII Y**. [src/app/api/ride/[id]/route.ts:17,49,88] |
| `/api/ride/[id]/passengers/[tripId]` | PATCH@12; DELETE@61 | `SES` + admin or assigned-driver check via `getRideCancellationAccess`; update/remove passenger and return ride data; **PII Y**. [src/app/api/ride/[id]/passengers/[tripId]/route.ts:12-58,61-95; src/lib/rideCancellationAccess.ts:9-17] |
| `/api/station-suggestions` | POST@29 | `SES`; create suggestion linked to requester identity; **PII Y**. [src/app/api/station-suggestions/route.ts:29-34,84-105] |
| `/api/stations` | GET@46; POST@109 | GET `SES` + region access; POST `ADM` with station-manage permission; read/create stations; **PII N**. [src/app/api/stations/route.ts:46,50-58,109-115] |
| `/api/stations/import` | POST@8 | `ADM`; import station data; **PII N**. [src/app/api/stations/import/route.ts:8] |
| `/api/stations/[id]` | PATCH@10; DELETE@88 | `ADM` with station-manage permission; update/deactivate station; **PII N**. [src/app/api/stations/[id]/route.ts:10,14,88,92] |
| `/api/support/chatbot` | GET@12; POST@17 | `PUB`; read/advance static support decision tree; **PII N**. [src/app/api/support/chatbot/route.ts:12,17] |
| `/api/support/conversations` | GET@16; POST@63 | GET `SES`; POST `SES` or creates guest conversation/access token; reads/creates support conversation; **PII Y**. [src/app/api/support/conversations/route.ts:16-31,63,72-127] |
| `/api/support/conversations/[id]/messages` | GET@55; POST@95 | `MIX`: session owner or guest `x-support-access-token`; read/write conversation messages; **PII Y**. [src/app/api/support/conversations/[id]/messages/route.ts:28-49,55,95] |
| `/api/support/unread` | GET@9 | `MIX`: session owner or verified guest `x-support-access-token`; read unread count; **PII Y**. [src/app/api/support/unread/route.ts:9-18,28-54] |
| `/api/trips` | GET@148; POST@184 | `SES` + role/ownership; read/create trips; **PII Y**. [src/app/api/trips/route.ts:148,184] |
| `/api/trips/expire` | POST@24; GET@124 | POST `CRON` (or admin); expire eligible bookings/trips. GET returns 405. **PII Y** for mutation. [src/app/api/trips/expire/route.ts:24-42,124] |
| `/api/trips/spacing` | GET@7 | `SES`; read caller’s holding trips/spacing; **PII Y**. [src/app/api/trips/spacing/route.ts:7-14] |
| `/api/trips/[id]` | GET@5 | `SES` + trip access; read trip; **PII Y**. [src/app/api/trips/[id]/route.ts:5] |
| `/api/trips/[id]/cancel` | GET@64; POST@162 | `SES` + trip participant/role; read cancellation data / cancel trip; **PII Y**. [src/app/api/trips/[id]/cancel/route.ts:64,162] |
| `/api/trips/[id]/chat` | GET@144; POST@200 | `SES` + trip participant; read/write trip chat; **PII Y**. [src/app/api/trips/[id]/chat/route.ts:144,200] |
| `/api/trips/[id]/chat/read` | POST@15 | `SES` + trip participant; mark chat read; **PII Y**. [src/app/api/trips/[id]/chat/read/route.ts:15] |
| `/api/trips/[id]/chat/report` | POST@31 | `SES` + trip participant; report chat; **PII Y**. [src/app/api/trips/[id]/chat/report/route.ts:31] |
| `/api/trips/[id]/pickup-pin` | GET@22 | `SES` + trip access; read pickup PIN; **PII Y**. [src/app/api/trips/[id]/pickup-pin/route.ts:22] |
| `/api/trips/[id]/rating` | GET@19; POST@44 | `SES` + trip participant; read/submit rating; **PII Y**. [src/app/api/trips/[id]/rating/route.ts:19,44] |
| `/api/trips/[id]/share` | POST@52; GET@195; DELETE@270 | `SES` + trip owner/participant; create/read/revoke share; **PII Y**. [src/app/api/trips/[id]/share/route.ts:52,195,270] |
| `/api/trips/[id]/share/location` | POST@21 | `SES` + share/trip authorization; update shared location; **PII Y**. [src/app/api/trips/[id]/share/location/route.ts:21] |
| `/api/upload` | POST@16 | `SES`; upload file and return private file path; **PII Y possible** (user-provided files). [src/app/api/upload/route.ts:16-18] |
| `/api/upload/[filename]` | GET@12 | `SES`; read uploaded file; **PII Y possible**. [src/app/api/upload/[filename]/route.ts:12-14] |
| `/api/vehicles` | GET@9 | `PUB`; read vehicle/rate configuration; **PII N**. [src/app/api/vehicles/route.ts:9] |
| `/api/vehicles/[key]` | GET@6; PATCH@23; DELETE@95 | GET `PUB`; PATCH/DELETE `ADM`; read/update/delete vehicle configuration; **PII N**. [src/app/api/vehicles/[key]/route.ts:6,23,27-28,95,99-100] |
| `/api/wallet` | GET@11 | `SES`; read caller’s wallet; **PII Y**. [src/app/api/wallet/route.ts:11] |
| `/api/wallet/payout-method` | GET@7; PATCH@33 | `SES`; read/update caller’s payout method; **PII Y**. [src/app/api/wallet/payout-method/route.ts:7,33] |
| `/api/wallet/reconcile` | POST@10 | `SES`/wallet-owner guard; reconcile caller’s wallet; **PII Y**. [src/app/api/wallet/reconcile/route.ts:10] |
| `/api/wallet/topup` | POST@17 | `SES`; create caller’s wallet top-up; **PII Y**. [src/app/api/wallet/topup/route.ts:17] |
| `/api/wallet/topup/verify` | POST@7 | `SES` + caller’s top-up ID; verify/settle top-up; **PII Y**. [src/app/api/wallet/topup/verify/route.ts:7,12-25] |
| `/api/wallet/withdraw` | GET@11; POST@37 | `SES`; read/create caller’s withdrawal; **PII Y**. [src/app/api/wallet/withdraw/route.ts:11,37] |
| `/api/wallet/withdraw/[id]/cancel` | POST@5 | `SES` + withdrawal owner; cancel withdrawal; **PII Y**. [src/app/api/wallet/withdraw/[id]/cancel/route.ts:5] |

## Public, token/secret, and candidate findings

- **Fixed during this audit:** the passenger mutation route had no guard. Both methods now require a session and the ride owner to be an admin or the assigned driver; tests cover anonymous, passenger, other-driver, assigned-driver, and admin access. See `src/app/api/ride/[id]/passengers/[tripId]/route.ts:12-58,61-95` and `tests/rideCancellationAccess.test.mjs`.
- **Clearly public by function:** health (`/api/actions`), login/registration/recovery/config flows, contact submission, geocoding/places/ORS, public vehicle reads, chatbot, and public VAPID key. Route classification for directions is `SES` in the table. Contact processes submitted contact details, but does not return personal account data (`src/app/api/contact/route.ts:4-40`).
- **Not unauthenticated:** live-share requires a verified signed token (`src/app/api/live/[token]/route.ts:35-40`); trip expiry POST checks cron/admin authorization (`src/app/api/trips/expire/route.ts:24-42`); payment webhook verifies signature (`src/app/api/payments/webhook/route.ts:116-140`); guest-support conversation access verifies the stored token hash (`src/app/api/support/conversations/[id]/messages/route.ts:28-49`).
- **Ambiguous/public-with-input rather than personal-data exposure:** `/api/support/conversations` allows guest conversation creation and issues guest access; guest follow-up reads/writes require the resulting access token (`src/app/api/support/conversations/route.ts:63,115-127`; token validation at `src/app/api/support/conversations/[id]/messages/route.ts:39-49`).
- **Product confirmation requested:** keep anonymous guest support conversation creation enabled? The implementation issues a guest access token and requires it for subsequent conversation reads/writes; no code change was made to this flow.
