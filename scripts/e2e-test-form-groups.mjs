/**
 * E2E test for TestForm two-groups mode (step 1 + step 3).
 * Run: npm run test:e2e:questions -- scripts/e2e-test-form-groups.mjs
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.APP_URL || 'http://localhost:5174';

test.describe('TestForm – две групи', () => {
  test('group tabs, validation and summary', async ({ page }) => {
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

    await page.goto(BASE);
    await page.getByRole('button', { name: 'Тестове' }).click();
    await page.getByRole('button', { name: '+ Създай нов тест' }).click();

    const modal = page.locator('.modal-content');

    // Step 1 – two groups
    await modal.getByPlaceholder('Въведете име на теста').fill('E2E две групи');
    await modal.locator('select').first().selectOption('10А E2E');
    await modal.locator('input[type="date"]').fill('2026-05-22');
    await modal.getByPlaceholder('Въведете точки').fill('10');
    await modal.getByRole('radio', { name: 'Две групи' }).check();
    await modal.getByRole('button', { name: 'Напред →' }).click();

    // Step 2
    await modal.getByRole('button', { name: /Изчисли стандартна скала/ }).click();
    await modal.getByRole('button', { name: 'Напред →' }).click();

    // Step 3 – add question
    await expect(modal.getByRole('heading', { name: 'Въпроси в теста' })).toBeVisible();
    await modal.getByRole('button', { name: '+ Добави един' }).click();

    const questionCard = modal.locator('.question-card').first();
    await expect(questionCard.getByRole('button', { name: 'I група', exact: true })).toBeVisible();
    await expect(questionCard.getByRole('button', { name: 'II група', exact: true })).toBeVisible();
    await expect(questionCard.getByText('Тип въпрос')).not.toBeVisible();

    // Validation – group I text
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.locator('.alert-error')).toContainText('I група');

    await questionCard.getByPlaceholder(/I група/).fill('Въпрос за I група');
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.locator('.alert-error')).toContainText('I група: попълнете верния отговор');

    await questionCard.getByPlaceholder('Очакван верен отговор').fill('Отговор I');
    await questionCard.getByRole('button', { name: 'II група', exact: true }).click();
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.locator('.alert-error')).toContainText('II група');

    await questionCard.getByPlaceholder(/II група/).fill('Въпрос за II група');
    await questionCard.getByPlaceholder('Очакван верен отговор').fill('Отговор II');
    await modal.getByRole('button', { name: 'Напред →' }).click();

    // Step 4 – summary
    await expect(modal.getByRole('heading', { name: 'Обобщение на теста' })).toBeVisible();
    await expect(modal.locator('.meta-value', { hasText: 'Две групи' })).toBeVisible();
    await expect(modal.getByText('I: Въпрос за I група', { exact: true })).toBeVisible();
    await expect(modal.getByText('II: Въпрос за II група', { exact: true })).toBeVisible();
    await expect(modal.getByText('I: Отговор I · II: Отговор II', { exact: true })).toBeVisible();
  });
});
