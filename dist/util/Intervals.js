import SlidingWindow from "./SlidingWindow";
export default class Intervals {
    constructor(size = 5) {
        this.last = 0;
        this.avg = new SlidingWindow(size);
    }
    ping() {
        if (this.last == 0) {
            this.last = Date.now();
            return;
        }
        let elapsed = Date.now() - this.last;
        this.last = Date.now();
        this.avg.push(elapsed);
    }
    averageSeconds() {
        let avg = this.avg.average();
        if (isNaN(avg))
            return avg;
        avg /= 1000;
        return avg;
    }
    average() {
        return this.avg.average();
    }
}
//# sourceMappingURL=Intervals.js.map