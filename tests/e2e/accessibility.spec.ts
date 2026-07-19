import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { login } from './helpers';

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

async function auditPage(page: Page) {
  await page.waitForTimeout(50);
  await page.addScriptTag({
    path: path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'),
  });
  const violations = await page.evaluate<AxeViolation[]>(async () => {
    const axeWindow = window as typeof window & {
      axe: {
        run: (
          root: Document,
          options: { resultTypes: string[] },
        ) => Promise<{ violations: AxeViolation[] }>;
      };
    };
    const result = await axeWindow.axe.run(document, { resultTypes: ['violations'] });
    return result.violations;
  });
  const severe = violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  const summary = severe.map((violation) => ({
    route: new URL(page.url()).pathname,
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

test.describe('Accessibility and responsive layout', () => {
  test('public pages have no serious automated accessibility violations', async ({ browser }) => {
    const context = await browser.newContext({ bypassCSP: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      for (const route of ['/', '/login', '/privacy', '/terms']) {
        await page.goto(route);
        await auditPage(page);
      }
    } finally {
      await context.close();
    }
  });

  test('authenticated mobile pages fit the viewport and privacy dialog traps focus', async ({
    browser,
    gentleUser,
  }) => {
    const context = await browser.newContext({
      bypassCSP: true,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    try {
      await login(page, gentleUser);
      for (const route of ['/dashboard', '/sleep', '/chat', '/profile']) {
        await page.goto(route);
        await expect
          .poll(() =>
            page.evaluate(() => ({
              viewport: document.documentElement.clientWidth,
              content: document.documentElement.scrollWidth,
            })),
          )
          .toMatchObject({ viewport: 390, content: 390 });
        await auditPage(page);
      }

      const trigger = page.getByRole('button', { name: 'Delete Account' });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Delete Account?' });
      await expect(dialog).toBeVisible();
      const confirmation = page.getByLabel('Confirmation phrase');
      await expect(confirmation).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(confirmation).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    } finally {
      await context.close();
    }
  });
});
