# Assets

Everything in this folder is **optional**. freeWii draws its graphics procedurally and synthesizes
its sounds, and swaps in a file as soon as it exists at the exact path below. Drop files, reload,
done: no code change, no registration. Missing files are simply ignored.

Formats: images **PNG with transparency** (sprites face right, bottom-anchored), backgrounds
**1920×1080 PNG or JPG**, audio **MP3** (44.1 kHz; OGG works too if you rename the path in the
channel's `assets.ts`). Music must loop seamlessly. Keep everything you drop here free of third-party
rights: this folder ships with the site.

## System (Wii Menu)

| Path | What |
| --- | --- |
| `system/music/menu-theme.mp3` | Menu theme, loops while the menu is shown |
| `system/cursor.png` | Hand cursor image (fingertip at 40% / 4% of the image), replaces the drawn hand |
| `system/cursor-grab.png` | Closed hand shown while A is held (optional) |
| `system/sfx/hover.mp3` | Cursor enters a tile / button |
| `system/sfx/select.mp3` | A pressed on a button |
| `system/sfx/back.mp3` | Back / close |
| `system/sfx/page.mp3` | Menu page slide |
| `system/sfx/open.mp3` | Channel tile zooms open |
| `system/sfx/start.mp3` | Channel starts |
| `system/sfx/home.mp3` | HOME Menu opens |
| `system/sfx/boot.mp3` | Leaving the warning screen |
| `system/sfx/connect.mp3` · `disconnect.mp3` | A phone joins / leaves |
| `system/sfx/deny.mp3` | Action refused |

## Channel banners (any channel)

| Path | What |
| --- | --- |
| `<channel>/banner.png` | 16:9 image shown in the tile and full screen (1280×720 or more) |
| `<channel>/banner.webm` | Looping muted video, preferred over the image when present |
| `<channel>/banner-music.mp3` | Jingle that loops while the channel preview is open |

## Sports channel: bowling

Images in `sports/bowling/`:

| File | What | Size hint |
| --- | --- | --- |
| `background.png` | Alley behind the lane: back wall, crowd, pinsetter housing (the lane itself stays procedural) | 1920×1080 |
| `ball.png` | Bowling ball, square, transparent corners | 512×512 |
| `pin.png` | Standing pin | ~200×600 |
| `pin-fallen.png` | Pin lying on its side (optional, else the standing pin is rotated) | ~600×200 |
| `bowler-idle.png` | Bowler seen from behind, holding the ball at the hip | ~600×1000 |
| `bowler-hold.png` | Ball lifted, ready to swing | same |
| `bowler-back.png` | Arm fully back (backswing) | same |
| `bowler-swing.png` | Arm forward, ball at knee height | same |
| `bowler-release.png` | Just after release, arm up front | same |
| `bowler-cheer.png` | Celebration (strike / spare) | same |
| `bowler-sad.png` | Disappointed (gutter / miss) | same |

Sounds in `sports/sfx/`: `intro.mp3` (game start jingle), `turn.mp3` (player card), `throw.mp3`, `roll.mp3` (loop while the ball rolls),
`crash-1.mp3` `crash-2.mp3` `crash-3.mp3` (pin impacts, picked at random), `gutter.mp3`, `strike.mp3`,
`spare.mp3`, `crowd-cheer.mp3`, `crowd-aww.mp3`, `pinsetter.mp3` (sweep bar).

Music in `sports/music/`: `menu.mp3` (sport selection loop), `alley.mp3` (bowling loop), `results.mp3` (game-over loop).

## Play channel: target range

Images in `play/range/`:

| File | What | Size hint |
| --- | --- | --- |
| `background.png` | Field, sky, fence… the whole scene without targets | 1920×1080 |
| `shelf.png` | Shelf the cans stand on (wide strip) | ~1600×60 |
| `balloon-1.png` `balloon-2.png` `balloon-3.png` | Balloons with string, different colours (any subset works) | ~300×600 |
| `clay.png` | Clay pigeon disc, seen slightly from above | ~400×200 |
| `can.png` · `can-dented.png` | Tin can, intact and after the first hit | ~300×500 |
| `duck-1.png` `duck-2.png` `duck-3.png` | Flying duck facing right, colour variants picked per duck (any subset works) | ~500×400 |
| `ufo.png` | Flying saucer | ~600×300 |
| `crosshair.png` | Crosshair, square, centred | 256×256 |
| `grass.png` | Foreground grass strip drawn along the bottom edge | 1920×~600 |

Sounds in `play/sfx/`: `shot.mp3`, `pop.mp3` (balloon), `clay.mp3` (shatter), `can.mp3` (metal ping),
`quack.mp3`, `ufo.mp3` (appears), `ufo-hit.mp3`, `miss.mp3`, `countdown.mp3` (last 3 seconds),
`go.mp3` (round start), `round-first.mp3` / `round-next.mp3` / `round-final.mp3` (round cards),
`bonus.mp3` (UFO down, combo ×5), `time-up.mp3`.

Music in `play/music/`: `menu.mp3` (game selection loop), `results.mp3` (results loop). The original range has
no in-game loop; add `range.mp3` if you want one.

## Play channel: fishing

Images in `play/fishing/` (all optional, the fish are drawn after the sticker sheet otherwise):

| File | What | Size hint |
| --- | --- | --- |
| `fish-fry.png` `fish-minnow.png` `fish-sunfish.png` `fish-puffer.png` `fish-gar.png` `fish-king.png` | One fish per species, facing right, transparent background | ~600×300 |
| `pond.png` | Whole scene without fish: grass, trees, the pond centred at 50% / 58% of the image, 80% wide, 62% tall | 1920×1080 |

## Draw channel

| Path | What |
| --- | --- |
| `draw/banner.png`, `draw/banner.webm`, `draw/banner-music.mp3` | Banner image / video / jingle, like any channel |
| `draw/music/draw.mp3` | Background loop while drawing (falls back to the menu theme) |

Drawings are kept in the browser (localStorage) between sessions and can be exported as PNG from the toolbar.

## Party, Vote, Music and Mii channels

All four use the generic banner files (`<channel>/banner.png`, `banner.webm`, `banner-music.mp3`) plus:

| Path | What |
| --- | --- |
| `party/music/menu.mp3`, `party/music/game.mp3`, `party/music/results.mp3` | Party game selection / in-game / results loops |
| `vote/music/loop.mp3` | Background loop while voting |
| `mii/music/plaza.mp3` | Background loop in the Mii editor |
| `homebrew/music/loop.mp3`, `homebrew/music/bricks.mp3` | Secret channel: launcher loop and Brick Breaker loop |

freeMusic synthesizes every instrument and drum, nothing to drop in. Saved Miis live in localStorage (`freewii.miis`).

## Adding assets to your own channel

Import `assetMap`, `useImages`, `drawSprite` and `ctx.audio.registerSamples` / `ctx.audio.sfx` from
`src/core`. See `src/channels/sports/assets.ts` for the pattern.
