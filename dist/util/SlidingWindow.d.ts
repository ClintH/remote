export default class SlidingWindow {
    data: number[];
    index: number;
    size: number;
    constructor(size?: number);
    push(v: number): void;
    average(): number;
    max(): number;
    min(): number;
}
