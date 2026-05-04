import Phaser from 'phaser';

import { GAMEPLAY } from '../config/economy';
import { UiButton } from '../objects/UiButton';
import { flushState, getState, setMusicEnabled, setSoundEnabled } from '../state';

/**
 * Sound + Music toggles. Audio playback is hooked up by individual scenes
 * via getState().soundEnabled / .musicEnabled.
 */
export class SettingsScene extends Phaser.Scene {
    private soundBtn!: UiButton;
    private musicBtn!: UiButton;

    constructor() {
        super('SettingsScene');
    }

    create(): void {
        const { designWidth, designHeight } = GAMEPLAY;
        const cx = designWidth / 2;

        this.add.image(cx, designHeight / 2, 'bg').setDisplaySize(designWidth, designHeight).setAlpha(0.45);

        this.add.text(cx, 140, 'Настройки', {
            fontFamily: 'sans-serif', fontSize: '56px', fontStyle: 'bold', color: '#ffffff',
            stroke: '#0d1f3c', strokeThickness: 6,
        }).setOrigin(0.5);

        new UiButton(this, 100, 80, '←', {
            width: 80, height: 80, textureKey: 'btn_dark', textColor: '#ffffff', fontSize: 36,
            onClick: () => this.scene.start('MainMenuScene'),
        });

        const baseY = designHeight / 2 - 80;

        this.soundBtn = new UiButton(this, cx, baseY, this.formatToggle('Звук', getState().soundEnabled), {
            width: 460, height: 100, textureKey: 'btn_secondary', textColor: '#ffffff', fontSize: 30,
            onClick: () => {
                setSoundEnabled(!getState().soundEnabled);
                this.soundBtn.setLabel(this.formatToggle('Звук', getState().soundEnabled));
                this.sound.mute = !(getState().soundEnabled);
                flushState().catch(() => undefined);
            },
        });

        this.musicBtn = new UiButton(this, cx, baseY + 130, this.formatToggle('Музыка', getState().musicEnabled), {
            width: 460, height: 100, textureKey: 'btn_secondary', textColor: '#ffffff', fontSize: 30,
            onClick: () => {
                setMusicEnabled(!getState().musicEnabled);
                this.musicBtn.setLabel(this.formatToggle('Музыка', getState().musicEnabled));
                flushState().catch(() => undefined);
            },
        });

        this.add.text(cx, designHeight - 240, 'Реклама показывается только\nпо нажатию кнопок и в логических паузах.', {
            fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', align: 'center',
        }).setOrigin(0.5);

        this.add.text(cx, designHeight - 120, 'v1.0  •  Phaser 3 + Matter.js', {
            fontFamily: 'sans-serif', fontSize: '20px', color: '#cccccc',
        }).setOrigin(0.5);
    }

    private formatToggle(name: string, enabled: boolean): string {
        return `${name}: ${enabled ? 'ВКЛ' : 'ВЫКЛ'}`;
    }
}
