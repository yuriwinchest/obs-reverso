/**
 * Age of the oldest media chunk still waiting to reach the encoder.
 *
 * Chunks finish in order, so a FIFO of start times is enough. Measuring
 * "time since the queue was last empty" instead would end a healthy live:
 * with a busy PC the queue rarely drains completely even when every chunk
 * gets through in well under a second.
 */
export class BacklogClock {
  private started: number[] = [];
  add(now: number) {
    this.started.push(now);
  }
  done() {
    this.started.shift();
  }
  clear() {
    this.started = [];
  }
  oldestAge(now: number) {
    return this.started.length ? now - this.started[0] : 0;
  }
}
