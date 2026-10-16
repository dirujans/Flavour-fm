# Flavour FM

The website for Flavour FM, Wingstop UK & Ireland's owned music and creator platform. Driven by Sound.

A static site: one `index.html`, no build step. The 3D scene is a WebGL particle field (three.js r128, vendored in `/js`) that morphs through the five purpose beats as you scroll:

1. Find talent: a dim crowd with one bright spark
2. Create and connect: five clusters joined by threads of light
3. Original music: a circular EQ
4. Inspire more: ripples spreading outward
5. Find their flavour: a torus knot in the full spectrum

Then the studio, drawn as a room of light with a hanging mic.

## The Flavour FM spectrum

Flavour Club owns green, lime and the headline skew. Flavour FM sits on Wingstop Green night and owns a spectrum built from Wingstop flavour colours, one band per purpose beat.

| Band | Beat | Colour |
|---|---|---|
| 01 | Find talent | Wingstop Lime `#D8F655` |
| 02 | Create and connect | Lemon Pepper `#FFCF00` |
| 03 | Original music | Mango Habanero `#FF7500` |
| 04 | Inspire more | Atomic, lifted for screen `#FF3B4E` |
| 05 | Find their flavour | Hawaiian `#00B5B9` |

Type is Roc Grotesk throughout. Compressed Black italic for headlines, Roc Wide for labels (Flavour FM's own type voice), Condensed and Regular for everything else.

## To do before going public

- Swap the studio photo frames for real studio photography
- Confirm the three room descriptions against the actual spec
- Confirm the contact address and the @flavourfm handles are live
- Confirm the Roc Grotesk licence covers web embedding
- Legal and safeguarding review of the studio session copy

## Run locally

```
python3 -m http.server 8000
```

Deployed on Vercel from `main`.

## Studio booking system

The booking flow on the site (three rooms, Monday to Friday, 10:00 to 18:00, request only) works straight away. Until Outlook is connected, every weekday shows as open for requests and a finished request gives the artist a copy-ready summary to email to the team.

Connecting it to Outlook makes two things happen automatically:

1. **Live availability.** The calendar reads each room's Outlook calendar, so busy sessions show as taken.
2. **Requests land in Outlook.** Each request becomes a *tentative* hold on the studio mailbox calendar, the team gets an email with every detail, and the artist (plus a guardian for under-18s) gets a copy with their reference. Nothing is ever confirmed automatically.

### What IT needs to set up (Microsoft 365)

1. **Three room mailboxes** in Exchange, one per room (Control room, Vocal booth, The lounge), plus a **studio mailbox** the team watches, for example `flavourfm@lemon-pepper.co.uk`.
2. **An app registration** in Microsoft Entra ID with these *application* permissions, admin consented:
   - `Calendars.ReadWrite`
   - `Mail.Send`
3. **Lock the app down** with an Exchange Application Access Policy so it can only touch the studio mailbox and the three room mailboxes, not the whole company.
4. **Add these environment variables** in Vercel (Project → Settings → Environment Variables), then redeploy:

| Variable | What it is |
|---|---|
| `MS_TENANT_ID` | Directory (tenant) ID |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | Client secret value |
| `STUDIO_MAILBOX` | The studio mailbox address |
| `ROOM_CONTROL_EMAIL` | Control room mailbox |
| `ROOM_BOOTH_EMAIL` | Vocal booth mailbox |
| `ROOM_LOUNGE_EMAIL` | Lounge mailbox |
| `STUDIO_NOTIFY_EMAIL` | Optional. Where new-request emails go (defaults to the studio mailbox) |
| `SEND_REQUESTER_COPY` | Optional. Set to `false` to stop the copy email to artists |
| `ATTACH_ROOM_ON_REQUEST` | Optional. Leave unset. `true` adds the room to the hold, which confirms instantly if the room auto-accepts |
| `STUDIO_TIMEZONE` | Optional. Defaults to `GMT Standard Time` |

### How the team approves a request

Open the tentative `REQUEST ·` event in the studio calendar, check it, then add the room to the event and reply to the artist to confirm (or decline with an alternative). Under-18 requests need guardian consent and a named supervising adult before confirming.

Session times, notice period (two working days), booking horizon (three months), room capacities and bank holidays live in `api/_graph.js` and the booking script in `index.html`.
