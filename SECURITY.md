# Security policy

freeWii has no backend, no database and no accounts. Everything runs in the browser, and the only
network traffic is the WebRTC link between a phone and a PC, plus the signaling handshake that sets
it up (the public PeerJS cloud by default, or your own server through `.env`).

That still leaves a few things worth reporting:

- A way to join a room you were not invited to, or to read another room's traffic.
- Anything that leaks the room code, the signaling id or sensor data to a third party.
- Cross-site scripting through a channel, the message board or a URL parameter.
- A dependency advisory that actually affects the built site.

## Reporting

Open a [private security advisory](https://github.com/Lucas-lux/freeWii/security/advisories/new)
on GitHub rather than a public issue. Include the steps to reproduce, the browsers and phones
involved and, if you have one, a patch. Expect a first answer within a week.

Room codes are four characters from a 32-symbol alphabet, which is enough to avoid collisions on a
home network but is **not** a secret: treat a room as joinable by anyone who sees the code.
