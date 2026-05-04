import Phaser from 'phaser';

import { ECONOMY, GAMEPLAY } from '../config/economy';
import { LEVELS, MAX_LEVEL, getLevel } from '../config/levels';
import { petTextureKey } from '../config/skins';
import { PetPool, PetSprite } from '../objects/PetPool';
import { gameplayStart, gameplayStop } from '../../sdk/yandexSdk';
import { addCoins, getState, updateBestScore } from '../state';

interface SpawnPreview {
    sprite: Phaser.GameObjects.Image;
    level: number;
}

type PetBody = MatterJS.BodyType & { gameObject?: PetSprite; label: string };
interface MergePair {
    bodyA: PetBody;
    bodyB: PetBody;
}

export interface GameOverPayload {
    score: number;
    coinsEarned: number;
    isNewBest: boolean;
}

const SCORE_BONUS_REWARDED = 'rewarded_continue_used';

const COLLISION_LABEL = 'pet_';

/**
 * Core gameplay scene: drag-from-top → drop → Matter merges identical animals
 * → score & coins → game over when the danger line is breached for too long.
 */
export class GameScene extends Phaser.Scene {
    private pool: PetPool;
    private currentSkinId: string = 'default';
    private heldPet: PetSprite | null = null;
    private nextLevel = 1;
    private nextPreview: SpawnPreview | null = null;

    private score = 0;
    private coinsEarnedThisRun = 0;
    private coinsBuffer = 0;
    /** Coins already flushed to the player wallet this run. */
    private coinsCreditedThisRun = 0;

    private dangerLineY = GAMEPLAY.dangerLineY;
    private gameOverTriggered = false;
    private continueUsed = false;
    private isPaused = false;
    private dropCooldownUntil = 0;
    private inputUnlockAt = 0;

    private wallTopBound = 80;
    private playableLeft = 40;
    private playableRight = GAMEPLAY.designWidth - 40;

    private scoreText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private coinsText!: Phaser.GameObjects.Text;
    private nextPreviewBg!: Phaser.GameObjects.Image;
    private dangerLineGfx!: Phaser.GameObjects.Graphics;
    private dangerCountdownText!: Phaser.GameObjects.Text;

    private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor() {
        super('GameScene');
        this.pool = null as unknown as PetPool;
    }

    init(data: { continueRun?: boolean } = {}): void {
        // Phaser keeps the scene instance between scene.start calls — every
        // mutable field has to be reset explicitly so a Replay starts clean.
        this.heldPet = null;
        this.nextPreview = null;
        this.dropCooldownUntil = 0;
        this.inputUnlockAt = 0;
        this.isPaused = false;
        this.gameOverTriggered = false;
        if (!data.continueRun) {
            this.score = 0;
            this.coinsEarnedThisRun = 0;
            this.coinsCreditedThisRun = 0;
            this.coinsBuffer = 0;
            this.continueUsed = false;
        }
    }

    create(): void {
        const { designWidth, designHeight } = GAMEPLAY;
        const cx = designWidth / 2;

        this.currentSkinId = getState().selectedSkin;
        this.matter.world.setBounds(0, 0, designWidth, designHeight, 64);
        const engine = this.matter.world.engine as unknown as { gravity: { x: number; y: number; scale: number } };
        engine.gravity.y = 1.0;
        engine.gravity.scale = 0.0025; // stronger fall (default 0.001 is too floaty for portrait playfield).

        // Background.
        this.add.image(cx, designHeight / 2, 'bg').setDisplaySize(designWidth, designHeight).setAlpha(0.45);

        // Walls + floor as static bodies for visualisation (the world-bounds
        // already prevent escape but we draw the playfield strip).
        const playfield = this.add.graphics();
        playfield.fillStyle(0x0d1f3c, 0.6);
        playfield.fillRoundedRect(this.playableLeft - 8, this.wallTopBound, this.playableRight - this.playableLeft + 16, designHeight - this.wallTopBound - 24, 24);
        playfield.lineStyle(2, 0xffffff, 0.18);
        playfield.strokeRoundedRect(this.playableLeft - 8, this.wallTopBound, this.playableRight - this.playableLeft + 16, designHeight - this.wallTopBound - 24, 24);

        // Danger line.
        this.dangerLineGfx = this.add.graphics().setDepth(2);
        this.drawDangerLine(false);
        this.dangerCountdownText = this.add.text(cx, this.dangerLineY - 30, '', {
            fontFamily: 'sans-serif', fontSize: '28px', color: '#ff5c5c', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(3).setAlpha(0);

        // HUD (score / best / coins / next-pet preview / pause).
        this.buildHud();

        // Particle emitter pool (single emitter, paused).
        this.particles = this.add.particles(0, 0, 'particle_white', {
            speed: { min: 80, max: 240 },
            scale: { start: 0.5, end: 0 },
            lifespan: 400,
            quantity: 14,
            tint: [0xffd166, 0xffffff, 0x4ea1d3],
            emitting: false,
        }).setDepth(5);

        // Pool.
        this.pool = new PetPool(this);

        // Matter collision listener for merges.
        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            for (const pair of event.pairs as unknown as MergePair[]) {
                this.tryMerge(pair);
            }
        });

        // Spawn first pet.
        this.queueNextSpawn();
        this.spawnHeldPet();

        // Pointer input.
        this.input.on('pointermove', this.handlePointerMove, this);
        this.input.on('pointerdown', this.handlePointerMove, this);
        this.input.on('pointerup', this.handlePointerUp, this);
        this.input.on('pointerupoutside', this.handlePointerUp, this);
        // Lock input briefly so the very first pointer-up that initiated the
        // scene transition (from MainMenuScene's Play button) does not
        // immediately drop the held pet.
        this.inputUnlockAt = this.time.now + 350;

        // ESC / P → pause.
        this.input.keyboard?.on('keydown-P', () => this.togglePause());
        this.input.keyboard?.on('keydown-ESC', () => this.togglePause());

        // Yandex GameplayAPI.
        gameplayStart();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            gameplayStop();
            this.input.off('pointermove', this.handlePointerMove, this);
            this.input.off('pointerdown', this.handlePointerMove, this);
            this.input.off('pointerup', this.handlePointerUp, this);
            this.input.off('pointerupoutside', this.handlePointerUp, this);
            this.matter.world.off('collisionstart');
            this.pool.destroy();
        });
    }

    /** Public API used by GameOverScene to apply rewarded ads. */
    public applyContinueReward(): void {
        if (this.continueUsed) return;
        this.continueUsed = true;
        // Remove pets that are above (or close to) the danger line.
        const cutoff = this.dangerLineY + 80;
        const toRemove: PetSprite[] = [];
        this.pool.forEachActive((pet) => {
            if (!pet.petHeld && pet.y < cutoff) toRemove.push(pet);
        });
        for (const pet of toRemove) this.pool.release(pet);
        // Reset breach timers on remaining pets.
        this.pool.forEachActive((pet) => { pet.aboveDangerSince = 0; });
        this.gameOverTriggered = false;
        // Ensure a fresh held pet exists.
        if (!this.heldPet) {
            this.queueNextSpawn();
            this.spawnHeldPet();
        }
        this.scene.resume();
        this.matter.resume();
        this.isPaused = false;
        this.events.emit(SCORE_BONUS_REWARDED);
    }

    public removeBottomThree(): void {
        const actives: PetSprite[] = [];
        this.pool.forEachActive((p) => { if (!p.petHeld) actives.push(p); });
        actives.sort((a, b) => b.y - a.y); // largest y first = closest to floor
        const target = Math.min(GAMEPLAY.removeBottomCount, actives.length);
        for (let i = 0; i < target; i++) {
            const pet = actives[i];
            this.flashAt(pet.x, pet.y);
            this.pool.release(pet);
        }
    }

    /** Convenience for menus that just want to know the current run status. */
    public getRunSummary(): GameOverPayload {
        const isNewBest = this.score > getState().bestScore;
        return { score: this.score, coinsEarned: this.coinsEarnedThisRun, isNewBest };
    }

    // ---------------------------------------------------------------------
    // HUD
    // ---------------------------------------------------------------------
    private buildHud(): void {
        const { designWidth } = GAMEPLAY;

        this.scoreText = this.add.text(designWidth / 2, 60, '0', {
            fontFamily: 'sans-serif', fontSize: '60px', fontStyle: 'bold', color: '#ffffff',
            stroke: '#0d1f3c', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(20);

        this.bestText = this.add.text(40, 28, `Рекорд: ${getState().bestScore}`, {
            fontFamily: 'sans-serif', fontSize: '24px', color: '#ffd166',
        }).setOrigin(0, 0).setDepth(20);

        this.coinsText = this.add.text(designWidth - 40, 28, `🪙 ${getState().coins + this.coinsEarnedThisRun - this.coinsCreditedThisRun}`, {
            fontFamily: 'sans-serif', fontSize: '24px', color: '#ffd166',
            fontStyle: 'bold',
        }).setOrigin(1, 0).setDepth(20);

        // Next preview tile (top-right under coin counter).
        this.nextPreviewBg = this.add.image(designWidth - 80, 130, 'btn_dark').setDisplaySize(120, 120).setDepth(20);
        this.add.text(this.nextPreviewBg.x, this.nextPreviewBg.y - 70, 'След.', {
            fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(20);

        // Pause button.
        const pauseBtn = this.add.text(60, 130, '⏸', {
            fontFamily: 'sans-serif', fontSize: '54px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
        pauseBtn.on('pointerup', () => this.togglePause());
    }

    private updateHud(): void {
        this.scoreText.setText(`${this.score}`);
        this.bestText.setText(`Рекорд: ${Math.max(getState().bestScore, this.score)}`);
        this.coinsText.setText(`🪙 ${getState().coins + this.coinsEarnedThisRun - this.coinsCreditedThisRun}`);
    }

    private updateNextPreview(): void {
        const lvl = this.nextLevel;
        const tex = petTextureKey(this.currentSkinId, lvl);
        if (this.nextPreview) {
            this.nextPreview.sprite.destroy();
            this.nextPreview = null;
        }
        const sprite = this.add.image(this.nextPreviewBg.x, this.nextPreviewBg.y, tex)
            .setDisplaySize(96, 96).setDepth(21);
        this.nextPreview = { sprite, level: lvl };
    }

    private drawDangerLine(active: boolean): void {
        const { designWidth } = GAMEPLAY;
        this.dangerLineGfx.clear();
        const color = active ? 0xff5c5c : 0xffffff;
        const alpha = active ? 0.8 : 0.4;
        this.dangerLineGfx.lineStyle(3, color, alpha);
        this.dangerLineGfx.beginPath();
        this.dangerLineGfx.moveTo(this.playableLeft, this.dangerLineY);
        this.dangerLineGfx.lineTo(designWidth - this.playableLeft, this.dangerLineY);
        this.dangerLineGfx.strokePath();
    }

    // ---------------------------------------------------------------------
    // Spawn / drop
    // ---------------------------------------------------------------------
    private queueNextSpawn(): void {
        // Spawn level 1 or 2 (slight bias to level 1).
        this.nextLevel = Math.random() < 0.7 ? 1 : 2;
        this.updateNextPreview();
    }

    private spawnHeldPet(): void {
        if (this.heldPet) return;
        const level = this.nextLevel;
        const x = GAMEPLAY.designWidth / 2;
        const y = this.wallTopBound + 60;
        const pet = this.pool.spawn(level, x, y, this.currentSkinId);
        pet.setIgnoreGravity(true);
        pet.setVelocity(0, 0);
        pet.setStatic(true);
        pet.petHeld = true;
        pet.setDepth(10);
        this.heldPet = pet;
        this.queueNextSpawn();
    }

    private handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
        if (this.isPaused || !this.heldPet) return;
        const lvl = getLevel(this.heldPet.petLevel);
        const x = Phaser.Math.Clamp(pointer.worldX, this.playableLeft + lvl.radius, this.playableRight - lvl.radius);
        this.heldPet.setPosition(x, this.wallTopBound + 60);
    };

    private handlePointerUp = (): void => {
        if (this.isPaused || !this.heldPet) return;
        const now = this.time.now;
        if (now < this.inputUnlockAt) return;
        if (now < this.dropCooldownUntil) return;
        this.dropCooldownUntil = now + GAMEPLAY.dropCooldownMs;

        const pet = this.heldPet;
        pet.petHeld = false;
        pet.setStatic(false);
        pet.setIgnoreGravity(false);
        pet.setVelocity(0, 0.5);
        this.heldPet = null;

        // Schedule next spawn.
        this.time.delayedCall(GAMEPLAY.dropCooldownMs, () => {
            if (!this.scene.isActive() || this.gameOverTriggered) return;
            this.spawnHeldPet();
        });
    };

    // ---------------------------------------------------------------------
    // Merge
    // ---------------------------------------------------------------------
    private tryMerge(pair: MergePair): void {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (!a.label?.startsWith(COLLISION_LABEL) || !b.label?.startsWith(COLLISION_LABEL)) return;
        const petA = a.gameObject as PetSprite | undefined;
        const petB = b.gameObject as PetSprite | undefined;
        if (!petA || !petB) return;
        if (petA === petB) return;
        if (petA.petHeld || petB.petHeld) return;
        if (petA.petMerging || petB.petMerging) return;
        if (petA.petLevel !== petB.petLevel) return;
        if (petA.petLevel >= MAX_LEVEL) return;

        petA.petMerging = true;
        petB.petMerging = true;

        const newLevel = petA.petLevel + 1;
        const meta = getLevel(newLevel);
        const mx = (petA.x + petB.x) / 2;
        const my = (petA.y + petB.y) / 2;

        // Score & coins.
        this.addScore(meta.mergeScore);
        if (newLevel === MAX_LEVEL) this.addScore(meta.mergeScore); // bonus on top level

        // FX.
        this.flashAt(mx, my);
        this.particles.emitParticleAt(mx, my, 18);

        // Release the two old pets next tick.
        this.time.delayedCall(0, () => {
            this.pool.release(petA);
            this.pool.release(petB);
            const merged = this.pool.spawn(newLevel, mx, my, this.currentSkinId);
            merged.petHeld = false;
            merged.setStatic(false);
            merged.setIgnoreGravity(false);
            merged.hasEnteredField = true; // merged in-field, never count as breach.
            // Preserve the texture-normalised display size set by PetPool.spawn:
            // start at 60% of those scales and animate back, otherwise the merged
            // pet would snap to the raw texture size after the tween.
            const targetScaleX = merged.scaleX;
            const targetScaleY = merged.scaleY;
            merged.setScale(targetScaleX * 0.6, targetScaleY * 0.6);
            this.tweens.add({
                targets: merged,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
                ease: Phaser.Math.Easing.Back.Out,
                duration: 220,
            });
        });
    }

    private addScore(delta: number): void {
        this.score += delta;
        const prevChunks = Math.floor(this.coinsBuffer / ECONOMY.scoreChunk);
        this.coinsBuffer += delta;
        const newChunks = Math.floor(this.coinsBuffer / ECONOMY.scoreChunk);
        const earned = (newChunks - prevChunks) * ECONOMY.coinsPerScoreChunk;
        if (earned > 0) this.coinsEarnedThisRun += earned;
        this.updateHud();
    }

    private flashAt(x: number, y: number): void {
        const flash = this.add.image(x, y, 'glow_soft').setBlendMode(Phaser.BlendModes.ADD).setDepth(4).setAlpha(0.9);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.6,
            duration: 320,
            onComplete: () => flash.destroy(),
        });
    }

    // ---------------------------------------------------------------------
    // Update loop
    // ---------------------------------------------------------------------
    update(_time: number, delta: number): void {
        if (this.gameOverTriggered || this.isPaused) return;

        const now = this.time.now;
        let anyAbove = false;

        this.pool.forEachActive((pet) => {
            if (pet.petHeld) return;
            // Slight angular drift damping (rotation is fixed but velocity may drift).
            const v = pet.body as MatterJS.BodyType;
            if (v) {
                const speed = Math.hypot(v.velocity.x, v.velocity.y);
                if (speed < 0.15 && Math.abs(pet.y - (GAMEPLAY.designHeight - 40)) < 1) {
                    /* settled near floor — nothing to do */
                }
            }
            // Mark pet as having entered the playfield once its top edge clears
            // the danger line. Until then, the pet is considered to be in the
            // drop zone and does not count toward the breach timer.
            const radius = getLevel(pet.petLevel).radius;
            if (!pet.hasEnteredField) {
                if (pet.y - radius >= this.dangerLineY) pet.hasEnteredField = true;
                pet.aboveDangerSince = 0;
                return;
            }
            if (pet.y - radius < this.dangerLineY) {
                anyAbove = true;
                if (pet.aboveDangerSince === 0) pet.aboveDangerSince = now;
            } else {
                pet.aboveDangerSince = 0;
            }
        });

        // Determine the longest sustained breach.
        let earliest = 0;
        this.pool.forEachActive((pet) => {
            if (pet.petHeld) return;
            if (pet.aboveDangerSince > 0) {
                if (earliest === 0 || pet.aboveDangerSince < earliest) earliest = pet.aboveDangerSince;
            }
        });

        if (earliest > 0) {
            const elapsed = (now - earliest) / 1000;
            const remaining = Math.max(0, GAMEPLAY.gameOverGraceSeconds - elapsed);
            this.drawDangerLine(true);
            this.dangerCountdownText.setText(`${remaining.toFixed(1)} с`).setAlpha(1);
            if (remaining <= 0) {
                this.triggerGameOver();
            }
        } else {
            this.drawDangerLine(false);
            this.dangerCountdownText.setAlpha(0);
            void anyAbove;
        }
        void delta;
    }

    private triggerGameOver(): void {
        if (this.gameOverTriggered) return;
        this.gameOverTriggered = true;
        const isNewBest = updateBestScore(this.score);
        // Only flush the run earnings that have NOT been credited yet, so a
        // rewarded continue followed by another game over doesn't pay twice.
        const uncredited = this.coinsEarnedThisRun - this.coinsCreditedThisRun;
        if (uncredited > 0) {
            addCoins(uncredited);
            this.coinsCreditedThisRun = this.coinsEarnedThisRun;
        }
        // Game over scene takes over (overlay).
        this.scene.pause();
        this.matter.pause();
        this.scene.launch('GameOverScene', {
            score: this.score,
            coinsEarned: this.coinsEarnedThisRun,
            isNewBest,
            continueUsed: this.continueUsed,
        });
    }

    private togglePause(): void {
        if (this.gameOverTriggered) return;
        if (this.isPaused) {
            this.isPaused = false;
            this.matter.resume();
            this.tweens.resumeAll();
        } else {
            this.isPaused = true;
            this.matter.pause();
            this.tweens.pauseAll();
        }
    }

    // ---------------------------------------------------------------------
    // Static helpers exposed for convenience to other scenes.
    // ---------------------------------------------------------------------
    static getLevelMeta(level: number) {
        return LEVELS[Math.max(0, Math.min(level, MAX_LEVEL) - 1)];
    }
}
