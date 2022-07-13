import SlidingWindow from "./SlidingWindow";
export default class Intervals {
    avg: SlidingWindow;
    last: number;
    constructor(size?: number);
    ping(): void;
    averageSeconds(): number;
    average(): number;
}
