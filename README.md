# Merge Pets 2048

HTML5 merge game for [Yandex.Games](https://yandex.ru/games/) built on
**Phaser 3 + TypeScript + Vite + Matter.js**. Designed for portrait 9:16
mobile play with a desktop fallback (centered canvas + framing background).

![](public/favicon.png)

## Features

- 10-level merge progression (мышка → мега-капибара).
- Matter.js physics with circular collision bodies and object pooling for
  pets, particles, and FX.
- Yandex SDK wrapper (`src/sdk/yandexSdk.ts`) with stubs that work in dev
  builds: `initYandexSdk`, `showInterstitialAd`, `showRewardedAd`,
  `saveToLeaderboard`, `loadPlayerData`, `savePlayerData`.
- Rewarded ad rewards: `continue_after_game_over`, `remove_bottom_3`,
  `double_coins`, `free_skin_chest`. All ads pause physics + audio.
- Coin economy + 4 skins (default/cats/capybaras/sweet) with localStorage
  persistence and Yandex player-data sync.
- Scenes: Boot → Preloader (progress bar) → MainMenu → Game → GameOver
  → Shop / Settings.
- Responsive: portrait 9:16 design surface scales to fit any viewport.

## Requirements

- [Node.js](https://nodejs.org/) **18+** (tested with Node 22).

## Available commands

| Command            | Description                                                  |
|--------------------|--------------------------------------------------------------|
| `npm install`      | Install dependencies (Phaser, Vite, TypeScript, Terser).     |
| `npm run dev`      | Launch the Vite dev server on `http://localhost:8080`.       |
| `npm run build`    | Type-check and bundle to `dist/`.                            |
| `npm run preview`  | Serve the production build locally for verification.         |
| `npm run zip`      | Pack `dist/` into `merge-pets-2048.zip` for Yandex.Games.    |
| `npm run typecheck`| Run `tsc --noEmit` only.                                     |

## Project layout

```
src/
  main.ts                 # Boot entry — DOMContentLoaded → startGame()
  game/
    main.ts               # Phaser config (Matter physics, FIT scale).
    config/
      levels.ts           # 10 animal level definitions + radii + scoring.
      skins.ts            # Skin catalog + texture-key helpers.
      economy.ts          # Coin / score / pacing tunables.
    objects/
      PetPool.ts          # Object pool for Matter sprites.
      UiButton.ts         # Reusable container button.
    scenes/
      BootScene.ts        # Kick off SDK + state load.
      PreloaderScene.ts   # Progress bar; preloads every skin × level.
      MainMenuScene.ts    # Play / Shop / Settings + best score.
      GameScene.ts        # Drag, drop, merge, danger line, pause.
      GameOverScene.ts    # Score, best, rewarded ads, replay/menu.
      ShopScene.ts        # Buy + equip skins.
      SettingsScene.ts    # Sound / music toggles.
    state.ts              # localStorage + Yandex player-data sync.
  sdk/
    yandexSdk.ts          # Yandex.Games SDK wrapper with debug fallbacks.

public/
  assets/
    animals/levelN.png    # default skin (10 PNGs).
    skins/cats/levelN.png
    skins/capybaras/levelN.png
    skins/sweet/levelN.png
    bg.png                # Background frame.
  favicon.png
  style.css

scripts/build-zip.mjs     # Validate dist + zip it for Yandex.Games.
```

## Yandex.Games — packaging the build

1. `npm install`
2. `npm run build` (creates `dist/index.html` + bundled assets).
3. `npm run zip` (validates and zips `dist/` to `merge-pets-2048.zip`).
4. Upload `merge-pets-2048.zip` to the [Yandex Games developer console](https://yandex.ru/dev/games/doc/dg/concepts/before-create.html).

The `zip` script automatically rejects file names with spaces or non-ASCII
characters, which Yandex.Games does not allow.

### Ad placement rules

The game shows ads only:

- on user-tap rewarded buttons in `GameOverScene` (continue, x2 coins,
  free-skin chest);
- via explicit `showInterstitialAd()` calls between gameplay sessions
  (the menus call this defensively when returning from a run).

No ads are triggered while a pet is mid-air. `GameScene.applyContinueReward()`
is called only after the SDK promise resolves.

### Yandex SDK loading

`index.html` includes
`<script src="https://yandex.ru/games/sdk/v2"></script>` plus an `onerror`
guard. When the SDK is missing (local dev, build preview), `yandexSdk.ts`
flips into debug mode and grants rewards immediately so designers can
iterate without needing a Yandex auth session.

## Asset credits

- Animal sprites: [Kenney Animal Pack](https://kenney.nl/assets/animal-pack)
  and [Animal Pack Redux](https://kenney.nl/assets/animal-pack-redux),
  used under the CC0 license. The `default` skin uses round filled sprites,
  `cats` uses the round-outline variant, `capybaras` uses square sprites,
  and `sweet` uses square-no-detail sprites.

## License

MIT — see `LICENSE`.
