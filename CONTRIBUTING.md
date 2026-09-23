# Contributing to freeWii

Thanks for wanting to add something. freeWii is built so that a new game is a folder, not a patch to
the core: if you can write a React component or draw on a canvas, you can ship a channel.

## Ground rules

1. **No copyrighted assets.** Nothing from Nintendo (or anyone else) may enter the repository:
   no sprites, no music, no sound effects, no fonts, no 3D models, no screenshots of the real console.
   Every graphic here is drawn procedurally and every sound is synthesized with the Web Audio API.
   Media you own or that is CC0/CC-BY is fine, with the licence recorded in the pull request.
   Files you keep locally in `public/assets/` are git-ignored on purpose: they stay on your machine.
2. **Everything runs client-side.** No backend, no telemetry, no account. The only network traffic is
   the WebRTC signaling handshake between the phone and the PC.
3. **Degrade gracefully.** Any asset can be missing, any remote can disconnect mid-game, and the
   mouse must be able to play alone. Code accordingly.

## Getting started

```bash
git clone https://github.com/Lucas-lux/freeWii.git
cd freeWii
npm install
npm run dev          # http://localhost:5173
npm run dev:https    # needed to test with a real phone (sensors require a secure origin)
```

Useful while developing:

- `?skipboot=1` skips the health-and-safety screen and lands on the Wii Menu.
- `window.freewii` in the browser console exposes the runtime: `store`, `input`, `audio`,
  `showToast()`, `unlockChannel(id)`, `relock()`.
- Without a phone: mouse = pointer, left click = A, right click = B, Esc/H = HOME, arrows = D-pad,
  `S` = swing, `+`/`-` and `1`/`2` map to the matching buttons.

## Adding a channel

Read [`src/channels/README.md`](src/channels/README.md) for the full API. The short version:

```
src/channels/my-game/
  channel.tsx     default-exports defineChannel({ id, title, banner, mount })
  Banner.tsx      the animated tile (size everything in cqw/cqh so it scales)
  MyGame.tsx      your game
  my-game.css     imported from channel.tsx
```

The registry globs `src/channels/*/channel.{ts,tsx}` at build time, so nothing else needs editing.
Mini-games that draw on a canvas should reuse `src/channels/_shared/MiniGame.tsx`, which gives you
the render loop, the HUD, the results screen and the Quit button for free.

Checklist before opening the pull request:

- [ ] `npm run build` passes (it type-checks first).
- [ ] The channel works with the mouse alone **and** with two or more remotes.
- [ ] Every asset the channel can use is optional and documented in `public/assets/README.md`.
- [ ] Sounds go through `ctx.audio`, never `new Audio()`, so the volume and mute settings apply.
- [ ] The HOME menu (`ctx.paused`) pauses your game loop.

## Style

TypeScript, strict mode, no `any`. Prettier config lives in `.prettierrc`:

```bash
npx prettier --write "src/**/*.{ts,tsx,css}"
```

Comments explain *why*, not *what*. English for code, identifiers and comments; issues and pull
requests can be in English or French.

Sizes in CSS use the stage unit: `calc(24 * var(--px))` where `--px` is 1/1280 of the stage width,
so the whole console scales with the window. Banners use container-query units (`cqw`, `cqh`).

## Pull requests

Keep one subject per pull request. Describe what you changed and how you tested it, and add a short
clip or a few screenshots for anything visual. If your change touches the core (`src/core/`),
say which channels you re-tested.

By contributing you agree that your work is released under the [MIT licence](LICENSE).
