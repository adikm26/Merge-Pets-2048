import Phaser from 'phaser';

import { GAMEPLAY } from '../config/economy';
import { MAX_LEVEL } from '../config/levels';
import { SKINS, petTextureKey } from '../config/skins';
import { initYandexSdk } from '../../sdk/yandexSdk';
import { loadState } from '../state';

/**
 * Loads every animal skin/level, generated UI textures, and bakes a few
 * runtime atlases (particle, danger-line, button bg).
 */
export class PreloaderScene extends Phaser.Scene {
    constructor() {
        super('PreloaderScene');
    }

    preload(): void {
        const { designWidth, designHeight } = GAMEPLAY;
        const cx = designWidth / 2;
        const cy = designHeight / 2;

        // Title.
        this.add
            .text(cx, cy - 200, 'Merge Pets 2048', {
                fontFamily: 'sans-serif',
                fontSize: '52px',
                fontStyle: 'bold',
                color: '#ffffff',
            })
            .setOrigin(0.5);

        // Progress bar background.
        const barW = 480;
        const barH = 28;
        const barX = cx - barW / 2;
        const barY = cy;
        const bg = this.add.rectangle(cx, barY, barW + 8, barH + 8, 0x1c3a6e).setStrokeStyle(2, 0xffffff, 0.7);
        bg.setOrigin(0.5);
        const fill = this.add.rectangle(barX + 4, barY - barH / 2, 1, barH, 0xffd166).setOrigin(0, 0);

        const pctText = this.add
            .text(cx, barY + 50, '0%', {
                fontFamily: 'sans-serif',
                fontSize: '24px',
                color: '#ffffff',
            })
            .setOrigin(0.5);

        this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
            fill.width = Math.max(2, p * barW);
            pctText.setText(`${Math.round(p * 100)}%`);
        });

        // Background.
        this.load.image('bg', 'assets/bg.png');

        // Pet textures (skin × level).
        for (const skin of SKINS) {
            for (let level = 1; level <= MAX_LEVEL; level++) {
                const key = petTextureKey(skin.id, level);
                this.load.image(key, `assets/${skin.folder}/level${level}.png`);
            }
        }
    }

    create(): void {
        // Generate small runtime textures (particle, glow, button bg) in code
        // so we don't ship extra PNGs.
        this.bakeParticleTexture();
        this.bakeGlowTexture();
        this.bakeButtonTexture('btn_primary', 0xffd166, 0x000000);
        this.bakeButtonTexture('btn_secondary', 0x4ea1d3, 0xffffff);
        this.bakeButtonTexture('btn_dark', 0x10243f, 0xffffff);
        this.bakePanelTexture();

        // In case the user loaded straight into the preloader (hot reload),
        // make sure SDK + state are at least kicked off.
        Promise.all([initYandexSdk(), loadState()])
            .catch(() => undefined)
            .finally(() => {
                this.scene.start('MainMenuScene');
            });
    }

    private bakeParticleTexture(): void {
        const size = 24;
        const g = this.add.graphics({ x: 0, y: 0 });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(size / 2, size / 2, size / 2);
        g.generateTexture('particle_white', size, size);
        g.destroy();
    }

    private bakeGlowTexture(): void {
        const size = 256;
        const g = this.add.graphics({ x: 0, y: 0 });
        // Soft radial glow approximated with concentric circles.
        for (let i = 0; i < 16; i++) {
            const r = (size / 2) * ((16 - i) / 16);
            const a = 0.05;
            g.fillStyle(0xffffff, a);
            g.fillCircle(size / 2, size / 2, r);
        }
        g.generateTexture('glow_soft', size, size);
        g.destroy();
    }

    private bakeButtonTexture(key: string, fill: number, stroke: number): void {
        const w = 320;
        const h = 96;
        const g = this.add.graphics({ x: 0, y: 0 });
        g.fillStyle(fill, 1);
        g.fillRoundedRect(0, 0, w, h, 24);
        g.lineStyle(4, stroke, 0.25);
        g.strokeRoundedRect(2, 2, w - 4, h - 4, 22);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    private bakePanelTexture(): void {
        const w = 600;
        const h = 800;
        const g = this.add.graphics({ x: 0, y: 0 });
        g.fillStyle(0x10243f, 0.92);
        g.fillRoundedRect(0, 0, w, h, 32);
        g.lineStyle(4, 0xffffff, 0.4);
        g.strokeRoundedRect(2, 2, w - 4, h - 4, 30);
        g.generateTexture('panel_dark', w, h);
        g.destroy();
    }
}
