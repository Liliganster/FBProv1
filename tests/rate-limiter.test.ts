import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../lib/rate-limiter';

describe('RateLimiter (in-memory)', () => {
  it('allows up to max requests in window', () => {
    const rl = new RateLimiter(3, 1000);
    const user = 'u1';
    const r1 = rl.checkLimit(user);
    const r2 = rl.checkLimit(user);
    const r3 = rl.checkLimit(user);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
    const r4 = rl.checkLimit(user);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});

