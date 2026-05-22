/**
 * E2E: TestList „Линк" button and TestLinkModal for online tests.
 * Run: npm run test:e2e:questions -- scripts/e2e-test-link-modal.mjs
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.APP_URL || 'http://localhost:5174';

const ONLINE_TEST_ID = 'e2e-online-test-1';
const OFFLINE_TEST_ID = 'e2e-offline-test-1';

const gradeScale = {
  grade2: 0,
  grade3: 4,
  grade4: 6,
  grade5: 8,
  grade6: 9,
};

const tests = [
  {
    id: ONLINE_TEST_ID,
    name: 'E2E онлайн тест',
    class_id: 'e2e-class-1',
    class_name: '10А E2E',
    type: 'Нормален тест',
    date: '2026-05-22',
    max_points: 10,
    grade_scale: gradeScale,
    questions: [],
    has_groups: true,
    mode: 'online',
    created_at: '2026-05-22T00:00:00Z',
    updated_at: null,
  },
  {
    id: OFFLINE_TEST_ID,
    name: 'E2E офлайн тест',
    class_id: 'e2e-class-1',
    class_name: '10А E2E',
    type: 'Нормален тест',
    date: '2026-05-21',
    max_points: 10,
    grade_scale: gradeScale,
    questions: [],
    has_groups: false,
    mode: 'offline',
    created_at: '2026-05-21T00:00:00Z',
    updated_at: null,
  },
];

const testTokens = [
  {
    id: 'tok-1',
    test_id: ONLINE_TEST_ID,
    group_number: 1,
    token: 'e2e-token-group-1',
    created_at: '2026-05-22T00:00:00Z',
  },
  {
    id: 'tok-2',
    test_id: ONLINE_TEST_ID,
    group_number: 2,
    token: 'e2e-token-group-2',
    created_at: '2026-05-22T00:00:00Z',
  },
];

test.describe('TestList – линк за онлайн тест', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/classes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'e2e-class-1',
            name: '10А E2E',
            school_year: '2025/2026',
            created_date: '2026-05-22T00:00:00Z',
            created_at: '2026-05-22T00:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/rest/v1/students**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/tests**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(tests),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/rest/v1/results**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/test_tokens**', async (route) => {
      const url = route.request().url();
      if (url.includes(`test_id=eq.${ONLINE_TEST_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(testTokens),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/test_analytics**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('shows Линк only for online tests and opens modal with group links', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Тестове' }).click();

    const onlineRow = page.getByRole('row', { name: /E2E онлайн тест/ });
    const offlineRow = page.getByRole('row', { name: /E2E офлайн тест/ });

    await expect(onlineRow.getByRole('button', { name: 'Линк' })).toBeVisible();
    await expect(offlineRow.getByRole('button', { name: 'Линк' })).toHaveCount(0);

    await onlineRow.getByRole('button', { name: 'Линк' }).click();

    const modal = page.locator('.modal-content');
    await expect(modal.getByRole('heading', { name: /Линк — E2E онлайн тест/ })).toBeVisible();
    await expect(modal.getByText('I група', { exact: true })).toBeVisible();
    await expect(modal.getByText('II група', { exact: true })).toBeVisible();

    const link1 = modal.locator('input[value*="e2e-token-group-1"]');
    const link2 = modal.locator('input[value*="e2e-token-group-2"]');
    await expect(link1).toBeVisible();
    await expect(link2).toBeVisible();
    await expect(link1).toHaveValue(/\/take\/e2e-token-group-1/);
    await expect(link2).toHaveValue(/\/take\/e2e-token-group-2/);

    await expect(modal.getByRole('button', { name: 'Копирай' })).toHaveCount(2);

    await modal.locator('.modal-body').getByRole('button', { name: 'Затвори' }).click();
    await expect(modal.getByRole('heading', { name: /Линк —/ })).toBeHidden();
  });
});
