# Pickup PIN configuration

Set `PICKUP_PIN_SECRET` to a private random secret containing at least 32
characters. The application fails closed with a configuration error if this
variable is missing, too short, or quoted.

Pickup PINs are derived from the Trip ID, Ride ID, and the Trip's `pinVersion`;
the PIN itself is never stored. Increment `pinVersion` to rotate a Trip's PIN.
Changing the assigned Ride also changes the derived PIN. Do not share the
secret or include it in client-side environment variables.

The derived PIN is four decimal digits. The HMAC result is mapped modulo
10,000, with negligible modulo bias.

The driver verification endpoint counts failed attempts atomically. Five
incorrect attempts lock verification for ten minutes; a successful verification
resets the failure counter. PIN values are not included in ride or security logs.
