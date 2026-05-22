/**
 * E2E smoke test for TestForm step 3 (Въпроси).
 * Run: npx playwright test scripts/e2e-test-form-questions.mjs
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.APP_URL || 'http://localhost:5174';

test.describe('TestForm – стъпка Въпроси', () => {
  test('multiple choice fields and validation', async ({ page }) => {
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

    // Step 1
    await modal.getByPlaceholder('Въведете име на теста').fill('E2E въпроси тест');
    await modal.locator('select').first().selectOption('10А E2E');
    await modal.locator('input[type="date"]').fill('2026-05-22');
    await modal.getByPlaceholder('Въведете точки').fill('10');
    await modal.getByRole('button', { name: 'Напред →' }).click();

    // Step 2 – fill scale
    await modal.getByRole('button', { name: /Изчисли стандартна скала/ }).click();
    await modal.getByRole('button', { name: 'Напред →' }).click();

    // Step 3 – add question
    await expect(modal.getByRole('heading', { name: 'Въпроси в теста' })).toBeVisible();
    await modal.getByRole('button', { name: '+ Добави един' }).click();

    const questionCard = modal.locator('.question-card').first();

    // Try next without text → validation error
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.locator('.alert-error')).toContainText('попълнете текста');

    // Fill short answer
    await questionCard.getByPlaceholder(/Въпрос 1/).fill('Каква е столицата?');
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.locator('.alert-error')).toContainText('верния отговор');

    await questionCard.getByPlaceholder('Очакван верен отговор').fill('София');
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.getByRole('heading', { name: 'Обобщение на теста' })).toBeVisible();

    // Back to step 3, switch to multiple choice
    await modal.locator('.stepper-step-label', { hasText: 'Въпроси' }).click();
    await questionCard.getByText('Тип въпрос').locator('..').locator('select').selectOption({ label: 'С избираем отговор' });
    await expect(questionCard.getByPlaceholder('Отговор A')).toBeVisible();
    await expect(questionCard.getByPlaceholder('Отговор D')).toBeVisible();

    await questionCard.getByPlaceholder('Отговор A').fill('Пловдив');
    await questionCard.getByPlaceholder('Отговор B').fill('София');
    await questionCard.getByPlaceholder('Отговор C').fill('Варна');
    await questionCard.getByPlaceholder('Отговор D').fill('Бургас');
    await questionCard.locator('input[type="radio"][value="B"]').check();
    await modal.getByRole('button', { name: 'Напред →' }).click();
    await expect(modal.getByRole('heading', { name: 'Обобщение на теста' })).toBeVisible();
    await expect(modal.getByText('Избираем отговор')).toBeVisible();
    await expect(modal.getByText('Верен: B')).toBeVisible();
  });
});
