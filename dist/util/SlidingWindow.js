export default class SlidingWindow {
    constructor(size = 5) {
        this.data = [];
        this.index = 0;
        this.size = size;
        for (let i = 0; i < size; i++) {
            this.data[i] = NaN;
        }
    }
    push(v) {
        let idx = this.index;
        this.data[idx++] = v;
        if (idx == this.size)
            idx = 0;
        this.index = idx;
    }
    average() {
        let total = 0;
        let samples = 0;
        for (let i = 0; i < this.size; i++) {
            if (isNaN(this.data[i]))
                continue;
            total += this.data[i];
            samples++;
        }
        return total / samples;
    }
    max() {
        let max = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < this.size; i++) {
            if (isNaN(this.data[i]))
                continue;
            max = Math.max(this.data[i], max);
        }
        return max;
    }
    min() {
        let min = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < this.size; i++) {
            if (isNaN(this.data[i]))
                continue;
            min = Math.min(this.data[i], min);
        }
        return min;
    }
}
//# sourceMappingURL=SlidingWindow.js.map