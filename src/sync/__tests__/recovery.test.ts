import { describe, expect, it } from 'vitest';

import { LIVE_SITE, newPasswordProblem, resetRedirectTo } from '../recovery';

describe('resetRedirectTo', () => {
  it('sends the link back to the site the person is using on the web', () => {
    expect(resetRedirectTo('http://localhost:8081')).toBe('http://localhost:8081/reset-password');
    expect(resetRedirectTo('https://life-plan-os-git-x.vercel.app')).toBe('https://life-plan-os-git-x.vercel.app/reset-password');
  });

  it('uses the live site on phones or when the origin is missing or odd', () => {
    expect(resetRedirectTo()).toBe(`${LIVE_SITE}/reset-password`);
    expect(resetRedirectTo(null)).toBe(`${LIVE_SITE}/reset-password`);
    expect(resetRedirectTo('null')).toBe(`${LIVE_SITE}/reset-password`);
    expect(resetRedirectTo('lifeplan://')).toBe(`${LIVE_SITE}/reset-password`);
    expect(resetRedirectTo('https://evil.example/path')).toBe(`${LIVE_SITE}/reset-password`);
  });
});

describe('newPasswordProblem', () => {
  it('needs at least 8 characters', () => {
    expect(newPasswordProblem('short', 'short')).toMatch(/8 characters/);
    expect(newPasswordProblem('', '')).toMatch(/8 characters/);
  });

  it('needs both entries to match', () => {
    expect(newPasswordProblem('longenough1', 'longenough2')).toMatch(/don’t match/);
  });

  it('accepts a good password', () => {
    expect(newPasswordProblem('longenough1', 'longenough1')).toBeNull();
  });
});
