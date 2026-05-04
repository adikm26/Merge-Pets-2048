import Phaser from 'phaser';

import { GAMEPLAY } from '../config/economy';
import { getSkin } from '../config/skins';
import { UiButton } from '../objects/UiButton';
import { getState } from '../state';

/**
 * Main menu — Play / Shop / Settings + best score + coin counter.
 */
export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create(): void {
        const { designWidth, designHeight } = GAMEPLAY;
        const cx = designWidth / 2;

        this.add.image(cx, designHeight / 2, 'bg')
            .setDisplaySize(designWidth, designHeight)
            .setAlpha(0.55);

        // Decorative pet stack in the title area.
        const skin = getSkin(getState().selectedSkin);
        const tex = (lvl: number) => `pet_${skin.id}_${lvl}`;
        const decorY = 320;
        this.add.image(cx, decorY, tex(6)).setDisplaySize(220, 220);
        this.add.image(cx - 160, decorY + 50, tex(3)).setDisplaySize(140, 140);
        this.add.image(cx + 160, decorY + 50, tex(4)).setDisplaySize(140, 140);

        // Title.
        this.add.text(cx, 140, 'Merge Pets 2048', {
            fontFamily: 'sans-serif',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#ffd166',
            stroke: '#0d1f3c',
            strokeThickness: 6,
        }).setOrigin(0.5);

        // Best score badge.
        const state = getState();
        this.add.text(cx, 220, `Лучший рекорд: ${state.bestScore}`, {
            fontFamily: 'sans-serif',
            fontSize: '32px',
            color: '#ffffff',
        }).setOrigin(0.5);

        // Coins badge (top-right).
        const coinPanel = this.add.image(designWidth - 130, 80, 'btn_dark').setDisplaySize(220, 72);
        this.add.text(coinPanel.x, coinPanel.y, `🪙  ${state.coins}`, {
            fontFamily: 'sans-serif',
            fontSize: '28px',
            color: '#ffd166',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // Buttons.
        const buttonY0 = designHeight - 380;
        const gap = 120;

        new UiButton(this, cx, buttonY0, 'Играть', {
            width: 360, height: 100, textureKey: 'btn_primary', textColor: '#0d1f3c',
            onClick: () => this.scene.start('GameScene'),
        });
        new UiButton(this, cx, buttonY0 + gap, 'Магазин', {
            width: 360, height: 100, textureKey: 'btn_secondary', textColor: '#ffffff',
            onClick: () => this.scene.start('ShopScene'),
        });
        new UiButton(this, cx, buttonY0 + gap * 2, 'Настройки', {
            width: 360, height: 100, textureKey: 'btn_dark', textColor: '#ffffff',
            onClick: () => this.scene.start('SettingsScene'),
        });
    }
}
