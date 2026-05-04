import Phaser from 'phaser';

export interface UiButtonOptions {
    width?: number;
    height?: number;
    textureKey?: string;
    color?: number;
    textColor?: string;
    fontSize?: number;
    onClick: () => void;
}

/**
 * Reusable button: image background + text label, pointer hover/down feedback.
 */
export class UiButton extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Image;
    private label: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, label: string, options: UiButtonOptions) {
        super(scene, x, y);
        const opts = {
            width: options.width ?? 320,
            height: options.height ?? 96,
            textureKey: options.textureKey ?? 'btn_primary',
            color: options.color ?? 0xffffff,
            textColor: options.textColor ?? '#0d1f3c',
            fontSize: options.fontSize ?? 32,
        };

        this.bg = scene.add.image(0, 0, opts.textureKey)
            .setDisplaySize(opts.width, opts.height)
            .setOrigin(0.5);
        this.label = scene.add.text(0, 0, label, {
            fontFamily: 'sans-serif',
            fontSize: `${opts.fontSize}px`,
            fontStyle: 'bold',
            color: opts.textColor,
        }).setOrigin(0.5);

        this.add([this.bg, this.label]);
        this.setSize(opts.width, opts.height);
        this.setInteractive(new Phaser.Geom.Rectangle(-opts.width / 2, -opts.height / 2, opts.width, opts.height), Phaser.Geom.Rectangle.Contains);

        this.on(Phaser.Input.Events.POINTER_OVER, () => this.setScale(1.04));
        this.on(Phaser.Input.Events.POINTER_OUT, () => this.setScale(1));
        this.on(Phaser.Input.Events.POINTER_DOWN, () => this.setScale(0.96));
        this.on(Phaser.Input.Events.POINTER_UP, () => {
            this.setScale(1);
            options.onClick();
        });

        scene.add.existing(this);
    }

    setLabel(text: string): this {
        this.label.setText(text);
        return this;
    }

    setEnabled(enabled: boolean): this {
        this.setAlpha(enabled ? 1 : 0.5);
        if (enabled) this.setInteractive();
        else this.disableInteractive();
        return this;
    }
}
