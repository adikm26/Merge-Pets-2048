import Phaser from 'phaser';

import { ECONOMY, GAMEPLAY } from '../config/economy';
import { SKINS } from '../config/skins';
import { UiButton } from '../objects/UiButton';
import { saveToLeaderboard, showRewardedAd } from '../../sdk/yandexSdk';
import { addCoins, flushState, getState, unlockSkin } from '../state';
import type { GameScene } from './GameScene';

interface GameOverData {
    score: number;
    coinsEarned: number;
    isNewBest: boolean;
    continueUsed: boolean;
}

/**
 * Game over panel: results, rewarded buttons (continue, x2 coins, free skin),
 * and replay/menu navigation.
 */
export class GameOverScene extends Phaser.Scene {
    private payload!: GameOverData;
    private doubleApplied = false;
    private chestApplied = false;
    private coinsEarnedShown = 0;

    private coinsLabel!: Phaser.GameObjects.Text;
    private continueBtn!: UiButton;
    private doubleBtn!: UiButton;
    private chestBtn!: UiButton;

    constructor() {
        super('GameOverScene');
    }

    init(data: GameOverData): void {
        this.payload = { ...data };
        this.coinsEarnedShown = data.coinsEarned;
        this.doubleApplied = false;
        this.chestApplied = false;
        // Persist + push best score to leaderboard.
        flushState().catch(() => undefined);
        if (data.isNewBest) saveToLeaderboard(data.score).catch(() => undefined);
    }

    create(): void {
        const { designWidth, designHeight } = GAMEPLAY;
        const cx = designWidth / 2;

        // Dim overlay.
        const overlay = this.add.rectangle(cx, designHeight / 2, designWidth, designHeight, 0x000000, 0.65).setDepth(0);
        overlay.setAlpha(0);
        this.tweens.add({ targets: overlay, alpha: 1, duration: 250 });

        const panel = this.add.image(cx, designHeight / 2, 'panel_dark').setDisplaySize(620, 980).setDepth(1).setAlpha(0).setScale(0.92);
        this.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: 280, ease: Phaser.Math.Easing.Back.Out });

        const baseY = designHeight / 2 - 360;

        const title = this.add.text(cx, baseY, this.payload.isNewBest ? 'Новый рекорд!' : 'Игра окончена', {
            fontFamily: 'sans-serif', fontSize: '52px', fontStyle: 'bold',
            color: this.payload.isNewBest ? '#ffd166' : '#ffffff', stroke: '#0d1f3c', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(2);
        if (this.payload.isNewBest) {
            this.tweens.add({ targets: title, scale: { from: 0.8, to: 1.0 }, duration: 480, ease: 'Sine.easeInOut', yoyo: true, repeat: 1 });
        }

        this.add.text(cx, baseY + 90, `Очки: ${this.payload.score}`, {
            fontFamily: 'sans-serif', fontSize: '36px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(2);

        this.add.text(cx, baseY + 140, `Рекорд: ${getState().bestScore}`, {
            fontFamily: 'sans-serif', fontSize: '28px', color: '#ffd166',
        }).setOrigin(0.5).setDepth(2);

        this.coinsLabel = this.add.text(cx, baseY + 190, this.formatCoinsLabel(), {
            fontFamily: 'sans-serif', fontSize: '28px', color: '#ffd166', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2);

        // Buttons (vertical stack centred).
        const btnY0 = baseY + 280;
        const gap = 110;

        // Continue (only once per run, hidden after use or if already used).
        this.continueBtn = new UiButton(this, cx, btnY0, 'Продолжить (реклама)', {
            width: 460, height: 92, textureKey: 'btn_primary', textColor: '#0d1f3c', fontSize: 28,
            onClick: () => this.handleContinue(),
        });
        if (this.payload.continueUsed) this.continueBtn.setEnabled(false);

        this.doubleBtn = new UiButton(this, cx, btnY0 + gap, 'x2 монеты (реклама)', {
            width: 460, height: 92, textureKey: 'btn_secondary', textColor: '#ffffff', fontSize: 28,
            onClick: () => this.handleDoubleCoins(),
        });

        this.chestBtn = new UiButton(this, cx, btnY0 + gap * 2, 'Сундук скина (реклама)', {
            width: 460, height: 92, textureKey: 'btn_secondary', textColor: '#ffffff', fontSize: 26,
            onClick: () => this.handleSkinChest(),
        });

        new UiButton(this, cx, btnY0 + gap * 3, 'Играть снова', {
            width: 460, height: 92, textureKey: 'btn_dark', textColor: '#ffffff', fontSize: 30,
            onClick: () => this.replay(),
        });
        new UiButton(this, cx, btnY0 + gap * 3 + 100, 'В меню', {
            width: 460, height: 88, textureKey: 'btn_dark', textColor: '#ffffff', fontSize: 26,
            onClick: () => this.toMenu(),
        });
    }

    private formatCoinsLabel(): string {
        return `Заработано: 🪙 ${this.coinsEarnedShown}`;
    }

    private async handleContinue(): Promise<void> {
        this.continueBtn.setEnabled(false);
        const ok = await showRewardedAd('continue_after_game_over');
        if (!ok) {
            this.continueBtn.setEnabled(true);
            return;
        }
        // Resume gameplay scene with rewarded continue.
        const game = this.scene.get('GameScene') as GameScene;
        game.applyContinueReward();
        this.scene.stop();
    }

    private async handleDoubleCoins(): Promise<void> {
        if (this.doubleApplied) return;
        this.doubleBtn.setEnabled(false);
        const ok = await showRewardedAd('double_coins');
        if (!ok) {
            this.doubleBtn.setEnabled(true);
            return;
        }
        // Already credited base earnings on game over; add the extra 1x.
        const extra = this.payload.coinsEarned * (ECONOMY.rewardedDoubleCoins - 1);
        addCoins(extra);
        this.coinsEarnedShown += extra;
        this.doubleApplied = true;
        this.coinsLabel.setText(this.formatCoinsLabel());
        flushState().catch(() => undefined);
    }

    private async handleSkinChest(): Promise<void> {
        if (this.chestApplied) return;
        this.chestBtn.setEnabled(false);
        const ok = await showRewardedAd('free_skin_chest');
        if (!ok) {
            this.chestBtn.setEnabled(true);
            return;
        }
        const locked = SKINS.filter((s) => !getState().unlockedSkins.includes(s.id));
        if (locked.length === 0) {
            // Already have everything → grant coins instead.
            addCoins(150);
            this.coinsEarnedShown += 150;
            this.coinsLabel.setText(this.formatCoinsLabel());
        } else {
            const pick = Phaser.Utils.Array.GetRandom(locked) as { id: string; title: string };
            unlockSkin(pick.id);
            this.add.text(GAMEPLAY.designWidth / 2, GAMEPLAY.designHeight / 2 + 250, `Получен скин: ${pick.title}`, {
                fontFamily: 'sans-serif', fontSize: '24px', color: '#ffd166', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(3);
        }
        this.chestApplied = true;
        flushState().catch(() => undefined);
    }

    private replay(): void {
        this.scene.stop('GameScene');
        this.scene.start('GameScene');
    }

    private toMenu(): void {
        this.scene.stop('GameScene');
        this.scene.start('MainMenuScene');
    }
}
