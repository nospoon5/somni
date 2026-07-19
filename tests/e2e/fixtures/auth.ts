import { test as base } from '@playwright/test';
import { TEST_ACCOUNTS } from '../../../scripts/fixture-utils.mjs';

type TestFixtures = {
  balancedUser: { email: string; password: string };
  gentleUser: { email: string; password: string };
  fastTrackUser: { email: string; password: string };
};

export const test = base.extend<TestFixtures>({
  balancedUser: async ({}, use) => {
    const user = TEST_ACCOUNTS.BALANCED;
    await use(user);
  },
  gentleUser: async ({}, use) => {
    const user = TEST_ACCOUNTS.GENTLE;
    await use(user);
  },
  fastTrackUser: async ({}, use) => {
    const user = TEST_ACCOUNTS.FAST_TRACK;
    await use(user);
  },
});

export { expect } from '@playwright/test';
