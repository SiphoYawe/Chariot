import { log } from "../logger.js";

export class RateLimiter {
  private count = 0;
  private currentDay: string;
  private readonly maxPerDay: number;

  constructor(maxPerDay: number) {
    this.maxPerDay = maxPerDay;
    this.currentDay = this.getUTCDay();
  }

  canExecuteRebalance(): boolean {
    this.resetIfNewDay();
    return this.count < this.maxPerDay;
  }

  recordRebalance(): void {
    this.resetIfNewDay();
    this.count++;

    log("info", "rebalance_recorded", {
      count: this.count,
      max: this.maxPerDay,
      remaining: this.maxPerDay - this.count,
      utcDay: this.currentDay,
    });

    if (this.count >= this.maxPerDay) {
      const nextWindow = this.getNextUTCDayStart();
      log("info", "rate_limit_reached", {
        count: this.count,
        max: this.maxPerDay,
        nextWindow: nextWindow.toISOString(),
      });
    }
  }

  getCount(): number {
    this.resetIfNewDay();
    return this.count;
  }

  private resetIfNewDay(): void {
    const today = this.getUTCDay();
    if (today !== this.currentDay) {
      log("info", "rate_limiter_reset", {
        previousDay: this.currentDay,
        newDay: today,
        previousCount: this.count,
      });
      this.currentDay = today;
      this.count = 0;
    }
  }

  private getUTCDay(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private getNextUTCDayStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }
}
