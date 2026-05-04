import { MAX_LEVEL } from './levels';

export interface SkinDefinition {
    /** Stable id stored in localStorage. */
    id: string;
    /** Display name (Russian). */
    title: string;
    /** Subdirectory under `public/assets/` (no trailing slash). */
    folder: string;
    /** Coin price (0 = free / unlocked by default). */
    price: number;
    /** Whether this skin is unlocked from the start. */
    unlockedByDefault: boolean;
}

export const SKINS: SkinDefinition[] = [
    { id: 'default',   title: 'Обычные животные', folder: 'animals',         price: 0,    unlockedByDefault: true },
    { id: 'cats',      title: 'Котики',           folder: 'skins/cats',      price: 250,  unlockedByDefault: false },
    { id: 'capybaras', title: 'Капибары',         folder: 'skins/capybaras', price: 500,  unlockedByDefault: false },
    { id: 'sweet',     title: 'Сладкие зверьки',  folder: 'skins/sweet',     price: 1000, unlockedByDefault: false },
];

export const DEFAULT_SKIN_ID = 'default';

export const getSkin = (id: string): SkinDefinition => {
    return SKINS.find((s) => s.id === id) ?? SKINS[0];
};

/** Texture key for a given skin/level. */
export const petTextureKey = (skinId: string, level: number): string =>
    `pet_${skinId}_${level}`;

/** All texture keys for a skin (for preloading). */
export const allPetTextureKeys = (skinId: string): string[] => {
    const out: string[] = [];
    for (let i = 1; i <= MAX_LEVEL; i++) out.push(petTextureKey(skinId, i));
    return out;
};
