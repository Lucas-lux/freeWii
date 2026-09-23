# Writing a channel

A channel is a folder in `src/channels/` with a `channel.tsx` (or `.ts`) whose **default export** is
`defineChannel({...})`. Nothing else to register: the menu globs this folder at build time.

```
src/channels/
  my-game/
    channel.tsx     <- required: defineChannel({ id, title, banner, mount })
    Banner.tsx      <- the animated tile
    MyGame.tsx      <- whatever you want
    my-game.css     <- import it from channel.tsx
```

## Minimal example

```tsx
// src/channels/my-game/channel.tsx
import { defineChannel, reactMount, type BannerProps, type ChannelContext } from '../../core';

function Banner({ active }: BannerProps) {
  // 1cqw = 1% of the banner width, so the tile scales from the menu to full screen
  return <div style={{ position: 'absolute', inset: 0, background: '#4fc3f7', fontSize: '12cqw' }}>My Game{active ? '!' : ''}</div>;
}

function MyGame({ ctx }: { ctx: ChannelContext }) {
  return <button onClick={() => ctx.exit()}>Back to the Wii Menu</button>;
}

export default defineChannel({
  id: 'my-game',          // [a-z0-9-], unique
  title: 'My Game',
  author: 'you',
  banner: Banner,
  mount: reactMount(MyGame),
});
```

Not a React fan? `mount(ctx)` receives a plain DOM element: render a canvas, Three.js, Phaser,
anything. Return `{ unmount() }` (plus optional `pause()` / `resume()` called when the HOME Menu opens).

## Secret channels

Add `secret: true` to `defineChannel({...})` and the tile stays out of the Wii Menu until something calls
`window.freewii.unlockChannel('<id>')` (persisted in localStorage, `window.freewii.relock()` hides them again).
The built-in `homebrew` channel is unlocked by lighting the LetterBomb letter on the Wii Message Board.

## The context (`ctx`)

| Field | What it is |
| --- | --- |
| `ctx.container` | Full-screen element, real pixels, 16:9. Use `ctx.onResize(cb)` to size a canvas. |
| `ctx.players` | Remotes that count as players, in player order (phones first, mouse/keyboard last). |
| `ctx.input` | The `InputManager`: `on('buttondown' | 'buttonup' | 'pointer' | 'swing' | 'motion' | 'remotes', ...)`. |
| `ctx.audio` | Synthesized sounds: `play('pop')`, or your own with `tone({...})` / `noise({...})`. |
| `ctx.exit()` | Back to the Wii Menu. |
| `ctx.setCursorVisible(v)` | Hide the hand cursor when you draw your own. |
| `ctx.paused` | True while the HOME Menu is open. |
| `ctx.messageBoard.post({...})` | Leave a note on the Wii Message Board. |

## Reading a remote (`Wiimote`)

```ts
remote.pointer          // { x, y } in 0..1 of the screen, onScreen, roll (radians)
remote.buttons.a        // a b home plus minus one two up down left right
remote.accel            // m/s² without gravity (phone only)
remote.on('swing', ({ strength, roll, direction }) => ...)   // detected arm swings
remote.rumble(120)      // phone vibration
remote.player           // 1..4
```

The mouse/keyboard remote emulates all of it: left click = A, right click = B, Esc = HOME, arrows = D-pad,
`S` = swing, and dragging fast while holding B is a swing too. Develop with it, test with the phone.

## React helpers (from `../../core`)

`useHot({ onClick })` makes any element clickable with the hand cursor (hover glow + sounds included),
`Pill` is the Wii-style button, `useButton('a', handler)`, `useInputEvent(...)`, `usePlayers()`,
`useAnimationFrame(dt => ...)`, `useElementSize(ref)`.

## Assets (optional files)

```ts
import { assetMap, useImages, drawSprite } from '../../core';
const IMAGES = assetMap('/assets/my-game', { hero: 'hero.png', bg: 'background.png' });
const SFX = assetMap('/assets/my-game/sfx', { jump: 'jump.mp3' });

// in your component
const images = useImages(IMAGES);                // { hero: HTMLImageElement | null, bg: ... }
useEffect(() => { void ctx.audio.registerSamples('my-game', SFX); }, [ctx]);
ctx.audio.sfx('my-game.jump', 'pop');             // sample if present, synthesized 'pop' otherwise
ctx.audio.playMusic({ url: '/assets/my-game/music/loop.mp3', synth: 'play' });
const engine = ctx.audio.startLoop('my-game.engine', { synth: 'hum' }); // later: engine.stop()
```

Channel definition extras: `bannerImage`, `bannerVideo` (shown instead of the React banner when the
file exists) and `bannerMusic` (jingle while the preview is open). Document your file names in
`public/assets/README.md` so players know what to drop where.

## Rules of the house

- Keep everything client-side: no server, no accounts, no telemetry.
- Ship only assets you have the right to distribute. Synthesize or draw, don't rip.
- Sizes in CSS: `calc(N * var(--px))` is 1/1280 of the screen width, so layouts stay identical on any screen.
- Look at `sports/` (canvas + motion) and `play/` (pointer) for complete examples.
