import Phaser from 'phaser';

import { LEVELS, MAX_LEVEL, getLevel } from '../config/levels';
import { petTextureKey } from '../config/skins';

export type PetSprite = Phaser.Physics.Matter.Image & {
    petLevel: number;
    petMerging: boolean;
    /** A pet that's still being held by the player (no physics yet). */
    petHeld: boolean;
    /** Time at which the pet first crossed the danger line, or 0. */
    aboveDangerSince: number;
    /**
     * True once the pet has fallen below the danger line at least once.
     * Until then the pet is in its drop-zone and must not count toward
     * the game-over breach timer (otherwise dropping always loses).
     */
    hasEnteredField: boolean;
};

const BODY_LABEL_PREFIX = 'pet_';
export const isPetBodyLabel = (label: string | undefined): boolean =>
    typeof label === 'string' && label.startsWith(BODY_LABEL_PREFIX);

/**
 * Pool wrapper that recycles Matter sprites instead of allocating new ones,
 * which keeps GC pressure low on weak phones.
 */
export class PetPool {
    private pool: PetSprite[] = [];
    private active: Set<PetSprite> = new Set();

    constructor(private scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics }) {}

    public get activeCount(): number {
        return this.active.size;
    }

    public forEachActive(fn: (pet: PetSprite) => void): void {
        this.active.forEach(fn);
    }

    public spawn(level: number, x: number, y: number, skinId: string): PetSprite {
        const lvlDef = getLevel(level);
        const tex = petTextureKey(skinId, level);

        let sprite = this.pool.pop();
        if (!sprite) {
            sprite = this.scene.matter.add.image(x, y, tex, undefined, {
                shape: { type: 'circle', radius: lvlDef.radius },
                friction: 0.02,
                frictionAir: 0.0,
                restitution: 0.05,
                density: 0.0015,
                slop: 0.01,
                label: `${BODY_LABEL_PREFIX}${level}`,
            }) as PetSprite;
        } else {
            sprite.setActive(true).setVisible(true);
            sprite.setTexture(tex);
            sprite.setPosition(x, y);
            sprite.setRotation(0);
            sprite.setVelocity(0, 0);
            sprite.setAngularVelocity(0);
            // Re-create body for the new radius.
            this.scene.matter.body.scale(sprite.body as MatterJS.BodyType, 1, 1);
            sprite.setBody({ type: 'circle', radius: lvlDef.radius }, {
                friction: 0.02,
                frictionAir: 0.0,
                restitution: 0.05,
                density: 0.0015,
                slop: 0.01,
                label: `${BODY_LABEL_PREFIX}${level}`,
            });
        }

        // Visual size: animal sprite slightly larger than the body radius for
        // a juicy look. Source PNGs are 96×96 / 128×128 — normalise via setDisplaySize.
        const visualDiameter = lvlDef.radius * 2.05;
        sprite.setDisplaySize(visualDiameter, visualDiameter);

        sprite.setStatic(false);
        sprite.setIgnoreGravity(true); // start in held mode; GameScene flips this on drop
        sprite.setSensor(false);
        sprite.setBounce(0.05);
        sprite.setFriction(0.02, 0.0, 0.001);
        sprite.setFixedRotation();

        sprite.petLevel = level;
        sprite.petMerging = false;
        sprite.petHeld = true;
        sprite.aboveDangerSince = 0;
        sprite.hasEnteredField = false;
        sprite.setData('pet', true);

        this.active.add(sprite);
        return sprite;
    }

    public release(sprite: PetSprite): void {
        if (!this.active.has(sprite)) return;
        this.active.delete(sprite);
        sprite.setActive(false).setVisible(false);
        sprite.setVelocity(0, 0);
        sprite.setAngularVelocity(0);
        sprite.setStatic(true);
        sprite.setSensor(true);
        sprite.petHeld = false;
        sprite.petMerging = false;
        sprite.aboveDangerSince = 0;
        sprite.hasEnteredField = false;
        // Move offscreen so it can't accidentally interact.
        sprite.setPosition(-9999, -9999);
        this.pool.push(sprite);
    }

    public destroy(): void {
        this.active.forEach((s) => s.destroy());
        this.pool.forEach((s) => s.destroy());
        this.active.clear();
        this.pool = [];
    }

    static maxLevel(): number {
        return MAX_LEVEL;
    }

    static levelMeta(level: number) {
        return LEVELS[Math.max(0, Math.min(level, MAX_LEVEL) - 1)];
    }
}
