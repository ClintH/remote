import { Manager } from "../Manager";
export declare type StatusDisplayOpts = {
    updateRateMs?: number;
    defaultOpacity?: number;
    hue?: number;
};
export declare class StatusDisplay {
    readonly manager: Manager;
    _el: HTMLElement | null;
    hue: number;
    constructor(manager: Manager, opts?: StatusDisplayOpts);
    getIndicators(parent: HTMLElement): HTMLElement[];
    getIndicator(parent: HTMLElement, label: string): HTMLElement | null;
    setIndicator(parent: HTMLElement, label: string, state: boolean, titleAddition?: string): void;
    createIndicator(label: string, title?: string): HTMLDivElement;
}
