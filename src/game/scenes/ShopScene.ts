import Phaser from 'phaser';

import { GAMEPLAY } from '../config/economy';
import { SKINS, petTextureKey } from '../config/skins';
import { UiButton } from '../objects/UiButton';
import { flushState, getState, selectSkin, trySpendCoins, unlockSkin } from '../state';

/**
 * Shop: paginated grid of skins. Buy with coins, then equip.
 */
export class ShopScene extends Phaser.Scene {
    private coinsText!: Phaser.GameObjects.Text;
    private rebuildPending = false;

    constructor() {
        super('ShopScene');
    }

    create(): void {
        const { designWidth, designHeight } = GAMEPLAY;
        const cx = designWidth / 2;

        this.add.image(cx, designHeight / 2, 'bg').setDisplaySize(designWidth, designHeight).setAlpha(0.45);

        this.add.text(cx, 100, 'Магазин', {
            fontFamily: 'sans-serif', fontSize: '56px', fontStyle: 'bold', color: '#ffffff',
            stroke: '#0d1f3c', strokeThickness: 6,
        }).setOrigin(0.5);

        this.coinsText = this.add.text(designWidth - 40, 60, '', {
            fontFamily: 'sans-serif', fontSize: '32px', color: '#ffd166', fontStyle: 'bold',
        }).setOrigin(1, 0);

        new UiButton(this, 100, 60, '←', {
            width: 80, height: 80, textureKey: 'btn_dark', textColor: '#ffffff', fontSize: 36,
            onClick: () => this.scene.start('MainMenuScene'),
        });

        this.renderSkins();
    }

    private refreshCoins(): void {
        this.coinsText.setText(`🪙 ${getState().coins}`);
    }

    private renderSkins(): void {
        this.refreshCoins();
        // Wipe previously rendered cards by destroying children with a flag.
        this.children.list
            .filter((c) => c.getData('skinCard'))
            .forEach((c) => c.destroy());

        const startY = 240;
        const rowH = 220;
        const cardW = 540;
        const cardH = 200;

        SKINS.forEach((skin, idx) => {
            const y = startY + idx * rowH;
            const cx = GAMEPLAY.designWidth / 2;

            const card = this.add.image(cx, y, 'panel_dark').setDisplaySize(cardW, cardH);
            card.setData('skinCard', true);

            // Preview tile (level 6 sprite as showcase).
            const preview = this.add.image(cx - cardW / 2 + 100, y, petTextureKey(skin.id, 6))
                .setDisplaySize(150, 150);
            preview.setData('skinCard', true);

            const title = this.add.text(cx - cardW / 2 + 200, y - 40, skin.title, {
                fontFamily: 'sans-serif', fontSize: '32px', fontStyle: 'bold', color: '#ffffff',
            }).setOrigin(0, 0.5);
            title.setData('skinCard', true);

            const state = getState();
            const unlocked = state.unlockedSkins.includes(skin.id);
            const equipped = state.selectedSkin === skin.id;

            const subtitle = this.add.text(
                cx - cardW / 2 + 200,
                y + 4,
                unlocked ? (equipped ? 'Активен' : 'Куплен') : `Цена: 🪙 ${skin.price}`,
                { fontFamily: 'sans-serif', fontSize: '24px', color: unlocked ? '#9be07c' : '#ffd166' },
            ).setOrigin(0, 0.5);
            subtitle.setData('skinCard', true);

            const actionLabel = unlocked ? (equipped ? 'Активен' : 'Надеть') : 'Купить';
            const btn = new UiButton(
                this,
                cx + cardW / 2 - 110,
                y,
                actionLabel,
                {
                    width: 180, height: 80, textureKey: equipped ? 'btn_dark' : 'btn_primary',
                    textColor: equipped ? '#9be07c' : '#0d1f3c', fontSize: 24,
                    onClick: () => this.handleSkinAction(skin.id),
                },
            );
            btn.setData('skinCard', true);
            if (equipped) btn.setEnabled(false);
        });
    }

    private handleSkinAction(skinId: string): void {
        if (this.rebuildPending) return;
        const state = getState();
        const skin = SKINS.find((s) => s.id === skinId);
        if (!skin) return;
        const unlocked = state.unlockedSkins.includes(skinId);
        if (!unlocked) {
            if (!trySpendCoins(skin.price)) {
                this.flashMessage('Недостаточно монет');
                return;
            }
            unlockSkin(skinId);
            selectSkin(skinId);
            flushState().catch(() => undefined);
        } else if (state.selectedSkin !== skinId) {
            selectSkin(skinId);
            flushState().catch(() => undefined);
        }
        this.rebuildPending = true;
        this.time.delayedCall(60, () => {
            this.rebuildPending = false;
            this.renderSkins();
        });
    }

    private flashMessage(msg: string): void {
        const t = this.add.text(GAMEPLAY.designWidth / 2, GAMEPLAY.designHeight - 100, msg, {
            fontFamily: 'sans-serif', fontSize: '28px', color: '#ff5c5c', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, duration: 1200, onComplete: () => t.destroy() });
    }
}
