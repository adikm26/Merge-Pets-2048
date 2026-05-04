import { startGame } from './game/main';

declare global {
    interface Window {
        __game?: Phaser.Game;
    }
}

const boot = () => {
    const game = startGame('game-container');
    window.__game = game;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
