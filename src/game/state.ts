import { DEFAULT_SKIN_ID, SKINS } from './config/skins';
import { loadPlayerData, savePlayerData } from '../sdk/yandexSdk';

const LS_KEY = 'merge_pets_2048_state_v1';

export interface PlayerState {
    bestScore: number;
    coins: number;
    unlockedSkins: string[];
    selectedSkin: string;
    soundEnabled: boolean;
    musicEnabled: boolean;
}

const defaultUnlocked = (): string[] =>
    SKINS.filter((s) => s.unlockedByDefault).map((s) => s.id);

export const defaultState = (): PlayerState => ({
    bestScore: 0,
    coins: 0,
    unlockedSkins: defaultUnlocked(),
    selectedSkin: DEFAULT_SKIN_ID,
    soundEnabled: true,
    musicEnabled: true,
});

let state: PlayerState = defaultState();
let dirty = false;

const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === 'string');

const sanitize = (raw: Partial<PlayerState> | null | undefined): PlayerState => {
    const def = defaultState();
    if (!raw || typeof raw !== 'object') return def;
    const out: PlayerState = { ...def };
    if (typeof raw.bestScore === 'number' && raw.bestScore >= 0) out.bestScore = Math.floor(raw.bestScore);
    if (typeof raw.coins === 'number' && raw.coins >= 0) out.coins = Math.floor(raw.coins);
    if (isStringArray(raw.unlockedSkins)) {
        out.unlockedSkins = Array.from(new Set([...def.unlockedSkins, ...raw.unlockedSkins]));
    }
    if (typeof raw.selectedSkin === 'string' && SKINS.some((s) => s.id === raw.selectedSkin)) {
        out.selectedSkin = raw.selectedSkin;
    }
    if (typeof raw.soundEnabled === 'boolean') out.soundEnabled = raw.soundEnabled;
    if (typeof raw.musicEnabled === 'boolean') out.musicEnabled = raw.musicEnabled;
    // Make sure selected skin is unlocked.
    if (!out.unlockedSkins.includes(out.selectedSkin)) out.selectedSkin = DEFAULT_SKIN_ID;
    return out;
};

const readLocal = (): PlayerState => {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return defaultState();
        return sanitize(JSON.parse(raw) as Partial<PlayerState>);
    } catch {
        return defaultState();
    }
};

const writeLocal = (s: PlayerState): void => {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {
        /* quota / privacy mode */
    }
};

export const getState = (): PlayerState => state;

export const updateState = (mutator: (s: PlayerState) => void): void => {
    mutator(state);
    dirty = true;
    writeLocal(state);
};

export const replaceState = (next: PlayerState): void => {
    state = sanitize(next);
    dirty = true;
    writeLocal(state);
};

export async function loadState(): Promise<PlayerState> {
    const local = readLocal();
    state = local;
    // Pull remote (Yandex) — if it's newer / more progress, merge it.
    try {
        const remote = await loadPlayerData();
        if (remote) {
            const merged = sanitize({
                ...local,
                ...(remote as Partial<PlayerState>),
                bestScore: Math.max(local.bestScore, Number(remote.bestScore) || 0),
                coins: Math.max(local.coins, Number(remote.coins) || 0),
                unlockedSkins: Array.from(
                    new Set([
                        ...local.unlockedSkins,
                        ...(isStringArray(remote.unlockedSkins) ? remote.unlockedSkins : []),
                    ]),
                ),
            });
            state = merged;
            writeLocal(state);
        }
    } catch {
        /* offline */
    }
    return state;
}

export async function flushState(): Promise<void> {
    if (!dirty) return;
    dirty = false;
    writeLocal(state);
    try {
        await savePlayerData(state as unknown as Record<string, unknown>);
    } catch {
        /* offline */
    }
}

// Domain helpers.
export const addCoins = (delta: number): void => {
    updateState((s) => {
        s.coins = Math.max(0, s.coins + Math.floor(delta));
    });
};

export const trySpendCoins = (cost: number): boolean => {
    if (state.coins < cost) return false;
    updateState((s) => {
        s.coins -= cost;
    });
    return true;
};

export const unlockSkin = (id: string): void => {
    updateState((s) => {
        if (!s.unlockedSkins.includes(id)) s.unlockedSkins.push(id);
    });
};

export const selectSkin = (id: string): boolean => {
    if (!state.unlockedSkins.includes(id)) return false;
    updateState((s) => {
        s.selectedSkin = id;
    });
    return true;
};

export const updateBestScore = (score: number): boolean => {
    if (score <= state.bestScore) return false;
    updateState((s) => {
        s.bestScore = Math.floor(score);
    });
    return true;
};

export const setSoundEnabled = (v: boolean): void => {
    updateState((s) => {
        s.soundEnabled = v;
    });
};
export const setMusicEnabled = (v: boolean): void => {
    updateState((s) => {
        s.musicEnabled = v;
    });
};
