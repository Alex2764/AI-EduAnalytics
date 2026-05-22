/**
 * E2E: public /take/:token page — identity, lockout, questions.
 * Run: npm run test:e2e:questions -- scripts/e2e-take-test-page.mjs
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.APP_URL || 'http://localhost:5174';

const TOKEN = 'e2e-take-token-g1';
const TEST_ID = 'e2e-take-test-1';
const CLASS_NAME = '10А E2E';

const testRow = {
  id: TEST_ID,
  name: 'E2E Take тест',
  class_id: 'e2e-class-1',
  class_name: CLASS_NAME,
  type: 'Нормален тест',
  date: '2026-05-22',
  max_points: 10,
  grade_scale: { grade2: 0, grade3: 4, grade4: 6, grade5: 8, grade6: 9 },
  questions: [
    {
      id: 'q1',
      text: 'fallback',
      points: 5,
      type: 'short_answer',
      group1: { text: 'Въпрос I група', correctAnswer: 'а' },
      group2: { text: 'Въпрос II група', correctAnswer: 'б' },
    },
    {
      id: 'q2',
      text: 'Единичен въпрос',
      points: 5,
      type: 'multiple_choice',
      options: ['A1', 'A2', 'A3', 'A4'],
      correctAnswer: 'A',
    },
  ],
  has_groups: true,
  mode: 'online',
  created_at: '2026-05-22T00:00:00Z',
  updated_at: null,
};

const tokenRow = {
  id: 'tok-take-1',
  test_id: TEST_ID,
  group_number: 1,
  token: TOKEN,
  created_at: '2026-05-22T00:00:00Z',
};

const students = [
  {
    id: 'stu-1',
    first_name: 'Иван',
    middle_name: 'Петров',
    last_name: 'Георгиев',
    class_name: CLASS_NAME,
    number: 1,
  },
  {
    id: 'stu-2',
    first_name: 'Мария',
    middle_name: 'Иванова',
    last_name: 'Димитрова',
    class_name: CLASS_NAME,
    number: 2,
  },
];

test.describe('TakeTestPage – /take/:token', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-take-lock-init')) {
        localStorage.removeItem('take-test-lock:e2e-take-token-g1');
        localStorage.removeItem('take-test-lock:e2e-take-token-bad');
        sessionStorage.setItem('e2e-take-lock-init', '1');
      }
    });

    await page.route('**/rest/v1/test_tokens**', async (route) => {
      const url = decodeURIComponent(route.request().url());
      if (url.includes('token=eq.') && (url.includes(TOKEN) || url.includes(encodeURIComponent(TOKEN)))) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([tokenRow]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/tests**', async (route) => {
      const url = route.request().url();
      if (url.includes(`id=eq.${TEST_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([testRow]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/students**', async (route) => {
      const url = route.request().url();
      if (url.includes('class_name=eq.')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(students),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/submissions**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'sub-1',
              test_id: TEST_ID,
              student_name: 'Иван Петров Георгиев',
              group_number: 1,
              answers: [],
              auto_points: 5,
              status: 'pending_review',
              created_at: '2026-05-22T12:00:00Z',
            },
          ]),
        });
        return;
      }
      await route.continue();
    });
  });

  test('loads test and shows identity form', async ({ page }) => {
    await page.goto(`${BASE}/take/${TOKEN}`);

    await expect(page.getByRole('heading', { name: 'E2E Take тест' })).toBeVisible();
    await expect(page.getByText(/Клас:.*10А E2E/)).toBeVisible();
    await expect(page.getByText(/Вариант:.*I група/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Идентификация' })).toBeVisible();
    await expect(page.getByPlaceholder('Иван')).toBeVisible();
    await expect(page.getByPlaceholder('Петров')).toBeVisible();
    await expect(page.getByPlaceholder('Георгиев')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Класове' })).toHaveCount(0);
  });

  test('wrong name shows error; success shows group questions', async ({ page }) => {
    await page.goto(`${BASE}/take/${TOKEN}`);

    await page.getByPlaceholder('Иван').fill('Грешен');
    await page.getByPlaceholder('Петров').fill('Ученик');
    await page.getByPlaceholder('Георгиев').fill('Тестов');
    await page.getByRole('button', { name: 'Продължи към теста' }).click();

    await expect(page.getByRole('alert')).toContainText(/не съвпада/i);
    await expect(page.getByText(/Остават 4 опита/)).toBeVisible();

    await page.getByPlaceholder('Иван').fill('Иван');
    await page.getByPlaceholder('Петров').fill('Петров');
    await page.getByPlaceholder('Георгиев').fill('Георгиев');
    await page.getByRole('button', { name: 'Продължи към теста' }).click();

    await expect(page.getByText(/Здравей.*Иван/)).toBeVisible();
    await expect(page.getByText('Въпрос I група')).toBeVisible();
    await expect(page.getByText('Въпрос II група')).toHaveCount(0);
    await expect(page.getByText('Въпрос 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Въпрос 2', { exact: true })).toBeVisible();
    await expect(page.getByText('A1')).toBeVisible();
  });

  test('blocks after 5 failed attempts', async ({ page }) => {
    await page.goto(`${BASE}/take/${TOKEN}`);

    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder('Иван').fill(`Грешен${i}`);
      await page.getByPlaceholder('Петров').fill('X');
      await page.getByPlaceholder('Георгиев').fill('Y');
      await page.getByRole('button', { name: 'Продължи към теста' }).click();
    }

    await expect(page.getByRole('heading', { name: 'Достъпът е блокиран' })).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Достъпът е блокиран' })).toBeVisible();
    await expect(page.getByPlaceholder('Иван')).toHaveCount(0);
  });

  test('legacy /take?token= redirects to /take/:token', async ({ page }) => {
    await page.goto(`${BASE}/take?token=${TOKEN}`);
    await expect(page).toHaveURL(new RegExp(`/take/${TOKEN}$`));
    await expect(page.getByRole('heading', { name: 'E2E Take тест' })).toBeVisible();
  });

  test('invalid token shows error', async ({ page }) => {
    await page.goto(`${BASE}/take/e2e-take-token-bad`);
    await expect(page.getByText(/Невалиден|изтекъл/i)).toBeVisible();
  });

  test('submit test shows success message', async ({ page }) => {
    await page.goto(`${BASE}/take/${TOKEN}`);

    await page.getByPlaceholder('Иван').fill('Иван');
    await page.getByPlaceholder('Петров').fill('Петров');
    await page.getByPlaceholder('Георгиев').fill('Георгиев');
    await page.getByRole('button', { name: 'Продължи към теста' }).click();

    await expect(page.getByText('Въпрос I група')).toBeVisible();

    await page.getByLabel('Вашият отговор').fill('мой кратък отговор');
    await page.getByRole('radio', { name: /A\. A1/ }).check();
    await page.getByRole('button', { name: 'Предай' }).click();

    await expect(page.getByText('Твоят тест е предаден успешно.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Предай' })).toHaveCount(0);
  });
});
