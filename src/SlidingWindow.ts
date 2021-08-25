export default class SlidingWindow {
  data: number[] = [];
  index: number = 0;
  size: number;

  constructor(size: number = 5) {
    this.size = size;
    for (let i = 0; i < size; i++) {
      this.data[i] = NaN;
    }
  }
  /**
   * Add data to the window
   *
   * @param {number} v Value to add
   * @memberof SlidingWindow
   */
  push(v: number) {
    let idx = this.index;
    this.data[idx++] = v;
    if (idx == this.size) idx = 0;
    this.index = idx;
  }

  /**
   * Calculates the current average
   *
   * @returns
   * @memberof SlidingWindow
   */
  average(): number {
    let total = 0;
    let samples = 0;
    for (let i = 0; i < this.size; i++) {
      if (isNaN(this.data[i])) continue;
      total += this.data[i];
      samples++;
    }
    return total / samples;
  }

  max(): number {
    let max = Number.MIN_SAFE_INTEGER;
    for (let i = 0; i < this.size; i++) {
      if (isNaN(this.data[i])) continue;
      max = Math.max(this.data[i], max);
    }
    return max;
  }

  min(): number {
    let min = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < this.size; i++) {
      if (isNaN(this.data[i])) continue;
      min = Math.min(this.data[i], min);
    }
    return min;
  }
}