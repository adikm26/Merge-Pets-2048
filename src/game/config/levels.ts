/**
 * Animal levels (1..N).
 *
 * The asset key for an animal is constructed at runtime from the active skin
 * (e.g. `pet_default_3`, `pet_cats_3`). The base file name is `level{N}.png`
 * inside the corresponding skin folder under `public/assets`.
 */
export interface AnimalLevel {
    /** 1-based level number. */
    level: number;
    /** Display name (Russian, used in UI). */
    displayName: string;
    /** Logical radius in pixels at design resolution (game width = 720). */
    radius: number;
    /** Score awarded when this level is created via merge. */
    mergeScore: number;
}

export const LEVELS: AnimalLevel[] = [
    { level: 1, displayName: 'Мышка',          radius: 32, mergeScore: 0 },
    { level: 2, displayName: 'Хомяк',          radius: 40, mergeScore: 4 },
    { level: 3, displayName: 'Кот',            radius: 50, mergeScore: 8 },
    { level: 4, displayName: 'Собака',         radius: 62, mergeScore: 16 },
    { level: 5, displayName: 'Лиса',           radius: 76, mergeScore: 32 },
    { level: 6, displayName: 'Панда',          radius: 90, mergeScore: 64 },
    { level: 7, displayName: 'Тигр',           radius: 104, mergeScore: 128 },
    { level: 8, displayName: 'Медведь',        radius: 120, mergeScore: 256 },
    { level: 9, displayName: 'Капибара',       radius: 140, mergeScore: 512 },
    { level: 10, displayName: 'Мега-Капибара', radius: 168, mergeScore: 1024 },
];

export const MAX_LEVEL = LEVELS.length;

export const getLevel = (level: number): AnimalLevel => {
    return LEVELS[Math.max(0, Math.min(level, LEVELS.length) - 1)];
};
