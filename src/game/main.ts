import Phaser from 'phaser';

import { GAMEPLAY } from './config/economy';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PreloaderScene } from './scenes/PreloaderScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';

const SCENES = [
    BootScene,
    PreloaderScene,
    MainMenuScene,
    GameScene,
    GameOverScene,
    ShopScene,
    SettingsScene,
];

export const startGame = (parent: string): Phaser.Game => {
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent,
        backgroundColor: '#0d1f3c',
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: GAMEPLAY.designWidth,
            height: GAMEPLAY.designHeight,
        },
        physics: {
            default: 'matter',
            matter: {
                gravity: { x: 0, y: 1.2 },
                enableSleeping: true,
                debug: false,
            },
        },
        render: {
            antialias: true,
            pixelArt: false,
            powerPreference: 'high-performance',
            roundPixels: false,
        },
        fps: {
            target: 60,
            forceSetTimeOut: false,
        },
        input: {
            activePointers: 2,
        },
        scene: SCENES,
        autoFocus: true,
    };

    return new Phaser.Game(config);
};

export default startGame;
