/**
 * Yandex.Games SDK wrapper.
 *
 * The real Yandex Games SDK injects a global `YaGames` object when loaded
 * from `https://yandex.ru/games/sdk/v2`. When the SDK is unavailable
 * (local dev, build preview, browsers without `YaGames`), this module
 * silently falls back to debug stubs so the game can run end-to-end.
 *
 * Public surface:
 *   - initYandexSdk()
 *   - showInterstitialAd()
 *   - showRewardedAd(rewardType)
 *   - saveToLeaderboard(score)
 *   - loadPlayerData()
 *   - savePlayerData()
 *
 * IMPORTANT: never call rewarded/fullscreen ads while a pet is actively
 * falling. The GameScene is responsible for pausing physics + audio
 * around ad calls; this module merely awaits the SDK promise.
 */

export type RewardType =
    | 'continue_after_game_over'
    | 'remove_bottom_3'
    | 'double_coins'
    | 'free_skin_chest';

interface YaGamesPlayer {
    getData(keys?: string[]): Promise<Record<string, unknown>>;
    setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
    getUniqueID?(): string;
}

interface YaGamesLeaderboards {
    setLeaderboardScore(boardName: string, score: number): Promise<void>;
}

interface YaGamesAdv {
    showFullscreenAdv(opts?: {
        callbacks?: {
            onClose?: (wasShown: boolean) => void;
            onError?: (err: unknown) => void;
            onOpen?: () => void;
            onOffline?: () => void;
        };
    }): void;
    showRewardedVideo(opts?: {
        callbacks?: {
            onOpen?: () => void;
            onRewarded?: () => void;
            onClose?: () => void;
            onError?: (err: unknown) => void;
        };
    }): void;
}

interface YaGamesInstance {
    adv: YaGamesAdv;
    getPlayer(): Promise<YaGamesPlayer>;
    getLeaderboards(): Promise<YaGamesLeaderboards>;
    features: {
        LoadingAPI?: { ready(): void };
        GameplayAPI?: { start(): void; stop(): void };
    };
}

interface YaGamesNamespace {
    init(): Promise<YaGamesInstance>;
}

declare global {
    interface Window {
        YaGames?: YaGamesNamespace;
        __YA_SDK_FAILED__?: boolean;
    }
}

const LEADERBOARD_NAME = 'merge_pets_2048_score';
const PLAYER_DATA_KEY = 'merge_pets_2048_state';
const STUB_LS_KEY = 'merge_pets_2048_remote_stub';

let ysdk: YaGamesInstance | null = null;
let player: YaGamesPlayer | null = null;
let leaderboards: YaGamesLeaderboards | null = null;
let initPromise: Promise<void> | null = null;
let debugMode = false;

const debugLog = (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.info('[YaSdk]', ...args);
};

export const isDebug = (): boolean => debugMode;

export const isReady = (): boolean => ysdk !== null;

export function initYandexSdk(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        try {
            if (!window.YaGames || window.__YA_SDK_FAILED__) {
                debugMode = true;
                debugLog('SDK not present; running in debug mode.');
                return;
            }
            ysdk = await window.YaGames.init();
            debugLog('SDK initialised.');
            try {
                player = await ysdk.getPlayer();
            } catch (err) {
                debugLog('getPlayer failed (probably no auth), falling back to local saves.', err);
                player = null;
            }
            try {
                leaderboards = await ysdk.getLeaderboards();
            } catch (err) {
                debugLog('getLeaderboards failed.', err);
                leaderboards = null;
            }
            try {
                ysdk.features.LoadingAPI?.ready();
            } catch (err) {
                debugLog('LoadingAPI.ready failed.', err);
            }
        } catch (err) {
            debugMode = true;
            debugLog('SDK init failed; switching to debug mode.', err);
        }
    })();
    return initPromise;
}

export function showInterstitialAd(): Promise<void> {
    return new Promise((resolve) => {
        if (!ysdk) {
            debugLog('Stub interstitial.');
            resolve();
            return;
        }
        try {
            ysdk.adv.showFullscreenAdv({
                callbacks: {
                    onClose: () => resolve(),
                    onError: (err) => {
                        debugLog('Interstitial error.', err);
                        resolve();
                    },
                },
            });
        } catch (err) {
            debugLog('Interstitial threw.', err);
            resolve();
        }
    });
}

/**
 * Show a rewarded ad. Resolves with `true` if the user actually earned the
 * reward (saw the ad to completion), and `false` otherwise. In debug mode
 * the reward is auto-granted so designers can iterate locally.
 */
export function showRewardedAd(rewardType: RewardType): Promise<boolean> {
    return new Promise((resolve) => {
        if (!ysdk) {
            debugLog('Stub rewarded:', rewardType);
            // Auto-grant in debug mode after a short tick.
            setTimeout(() => resolve(true), 120);
            return;
        }
        let rewarded = false;
        try {
            ysdk.adv.showRewardedVideo({
                callbacks: {
                    onRewarded: () => {
                        rewarded = true;
                    },
                    onClose: () => resolve(rewarded),
                    onError: (err) => {
                        debugLog('Rewarded error.', err);
                        resolve(false);
                    },
                },
            });
        } catch (err) {
            debugLog('Rewarded threw.', err);
            resolve(false);
        }
    });
}

export async function saveToLeaderboard(score: number): Promise<void> {
    if (!leaderboards) {
        debugLog('Stub saveToLeaderboard:', score);
        return;
    }
    try {
        await leaderboards.setLeaderboardScore(LEADERBOARD_NAME, score);
    } catch (err) {
        debugLog('saveToLeaderboard failed.', err);
    }
}

export async function loadPlayerData(): Promise<Record<string, unknown> | null> {
    if (!player) {
        try {
            const raw = localStorage.getItem(STUB_LS_KEY);
            return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
    try {
        const data = await player.getData([PLAYER_DATA_KEY]);
        const value = data[PLAYER_DATA_KEY];
        return (value && typeof value === 'object') ? (value as Record<string, unknown>) : null;
    } catch (err) {
        debugLog('loadPlayerData failed.', err);
        return null;
    }
}

export async function savePlayerData(data: Record<string, unknown>): Promise<void> {
    if (!player) {
        try {
            localStorage.setItem(STUB_LS_KEY, JSON.stringify(data));
        } catch (err) {
            debugLog('Stub savePlayerData failed.', err);
        }
        return;
    }
    try {
        await player.setData({ [PLAYER_DATA_KEY]: data }, true);
    } catch (err) {
        debugLog('savePlayerData failed.', err);
    }
}

export function gameplayStart(): void {
    try {
        ysdk?.features.GameplayAPI?.start();
    } catch {
        /* ignore */
    }
}

export function gameplayStop(): void {
    try {
        ysdk?.features.GameplayAPI?.stop();
    } catch {
        /* ignore */
    }
}
