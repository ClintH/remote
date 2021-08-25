import SlidingWindow from "./SlidingWindow";
export default class Intervals {
  avg: SlidingWindow;
  last: number = 0;

  constructor(size: number = 5) {
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
    if (isNaN(avg)) return avg;
    avg /= 1000;
    return avg;
  }
  average() {
    return this.avg.average();
  }
}