/**
 * Economy tuning. All gameplay-facing numbers in one place.
 */
export const ECONOMY = {
    /** Coins earned for every CHUNK score points within a single run. */
    coinsPerScoreChunk: 1,
    scoreChunk: 25,

    /** Bonus coin rewards. */
    rewardedDoubleCoins: 2,
    freeSkinChestCount: 1,
} as const;

export const GAMEPLAY = {
    /** Logical design resolution. */
    designWidth: 720,
    designHeight: 1280,

    /** Vertical position of the danger line (in design pixels from the top). */
    dangerLineY: 240,

    /** Continuous seconds an animal must stay above the danger line to lose. */
    gameOverGraceSeconds: 3,

    /** Cooldown between drops (ms). */
    dropCooldownMs: 250,

    /** When spawning a new pet, max level allowed for the seeded animal. */
    spawnMaxLevel: 2,

    /** Number of pets removed by `remove_bottom_3` rewarded ad. */
    removeBottomCount: 3,
} as const;
