import Phaser from 'phaser';

import { initYandexSdk } from '../../sdk/yandexSdk';
import { loadState } from '../state';

/**
 * Boot scene: kick off Yandex SDK init + local state load in parallel,
 * then hand off to PreloaderScene which actually loads the asset bundle.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload(): void {
        // Tiny inline 1x1 pixel as a fallback texture.
        this.load.image('__pixel', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=');
    }

    create(): void {
        // Fire and forget; Preloader can also call these defensively.
        Promise.all([initYandexSdk(), loadState()]).catch(() => undefined);
        this.scene.start('PreloaderScene');
    }
}
