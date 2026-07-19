import { test, expect } from './fixtures/auth';

test.describe('Production browser security policy', () => {
  test('loads styled assets and applies one matching nonce without CSP errors', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    try {
      const response = await page.goto('/');
      expect(response?.status()).toBe(200);
      const policy = response?.headers()['content-security-policy'] ?? '';
      const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
      expect(nonce).toBeTruthy();
      expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(policy).not.toContain("script-src 'self' 'unsafe-eval'");
      expect(policy).not.toContain('upgrade-insecure-requests');

      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 12, 26)');
      await expect(page.getByRole('img', { name: 'Somni' })).toBeVisible();
      const assetState = await page.evaluate(() => ({
        styleSheetCount: document.styleSheets.length,
        logoWidth:
          document.querySelector<HTMLImageElement>('img[alt="Somni"]')?.naturalWidth ?? 0,
        scriptNonces: Array.from(document.scripts).map((script) => script.nonce),
        styleNonces: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
          (link) => (link as HTMLLinkElement).nonce,
        ),
      }));
      expect(assetState.styleSheetCount).toBeGreaterThan(0);
      expect(assetState.logoWidth).toBeGreaterThan(0);
      expect(assetState.scriptNonces.length).toBeGreaterThan(0);
      expect(assetState.scriptNonces.every((value) => value === nonce)).toBe(true);
      expect(assetState.styleNonces.every((value) => value === nonce)).toBe(true);
      expect(browserErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
