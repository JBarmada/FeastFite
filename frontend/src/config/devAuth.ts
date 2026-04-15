import type { User } from '@feastfite/shared';

/**
 * LOCAL TESTING ONLY — set to `false` before any real deployment.
 *
 * When `true`:
 * - App behaves as logged in with a fake user (no login/register needed).
 * - API calls send `DEV_FAKE_TOKEN`; economy + territory services must run with
 *   matching bypass (see `DEV_AUTH_BYPASS` in those services).
 */
export const AUTH_DISABLED = false;

/** Stable UUID so ledger / territory rows stay consistent across reloads. */
export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

/** Placeholder JWT string — not validated when backend bypass is on. */
export const DEV_FAKE_TOKEN = 'dev-bypass-token';

export const DEV_FAKE_USER: User = {
  id: DEV_USER_ID,
  email: 'dev@local.test',
  username: 'DevTester',
  clanId: null,
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
  updatedAt: new Date('2020-01-01T00:00:00.000Z'),
};
