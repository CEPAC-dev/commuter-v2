# Passenger driver-phone visibility

Passengers receive the matched driver's current phone number only while their own
Trip belongs to that driver on a linked Ride whose status is `confirmed` or
`active`. The Trip must still be a passenger on that Ride and must not be ended.
The server checks this rule through `canPassengerSeeDriverPhone` before serializing
the phone. It strips any phone stored in an assigned-driver snapshot and uses the
current Ride driver's User record, so a reassignment cannot expose the former
driver's number.

Passenger Trip list and detail responses are private and non-cacheable. The detail
page renders a localized “Call driver” action and the number only when the server
included the phone. Driver and admin views retain their existing access. The public
live-share projection does not include phone numbers. Assignment notifications and
Ride logs contain no driver phone number.

Historical notification records could not be checked because the configured
database did not complete a read-only connection during this audit. No historical
records were modified.
