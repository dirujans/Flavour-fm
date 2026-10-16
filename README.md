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
