/**
 * E2E: teacher reviews online submission → finalize → result in list.
 * Run: npm run test:e2e:review
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.APP_URL || 'http://localhost:5174';

const TEST_ID = 'e2e-review-test-1';
const STUDENT_ID = 'e2e-stu-review-1';
const SUBMISSION_ID = 'e2e-sub-1';
const CLASS_NAME = '10А E2E';

const gradeScale = {
  grade2: 0,
  grade3: 4,
  grade4: 6,
  grade5: 8,
  grade6: 9,
};

const testRow = {
  id: TEST_ID,
  name: 'E2E Review тест',
  class_id: 'e2e-class-1',
  class_name: CLASS_NAME,
  type: 'Нормален тест',
  date: '2026-05-22',
  max_points: 10,
  grade_scale: gradeScale,
  questions: [
    {
      id: 'q1',
      text: 'Изборен въпрос',
      points: 5,
      type: 'multiple_choice',
      options: ['A1', 'A2', 'A3', 'A4'],
      correctAnswer: 'A',
    },
    {
      id: 'q2',
      text: 'Кратък отговор',
      points: 5,
      type: 'short_answer',
      correctAnswer: 'София',
    },
  ],
  has_groups: false,
  mode: 'online',
  created_at: '2026-05-22T00:00:00Z',
  updated_at: null,
};

const studentRow = {
  id: STUDENT_ID,
  first_name: 'Иван',
  middle_name: 'Петров',
  last_name: 'Георгиев',
  class_name: CLASS_NAME,
  number: 1,
  gender: 'male',
};

const pendingSubmission = {
  id: SUBMISSION_ID,
  test_id: TEST_ID,
  student_name: 'Иван Петров Георгиев',
  group_number: 1,
  answers: [
    { questionId: 'q1', answer: 'A', auto_points: 5 },
    { questionId: 'q2', answer: 'Пловдив', auto_points: 0 },
  ],
  auto_points: 5,
  status: 'pending_review',
  created_at: '2026-05-22T12:00:00Z',
};

test.describe('Submissions review – finalize to results', () => {
  let resultsStore = [];
  let submissionFinalized = false;

  test.beforeEach(async ({ page }) => {
    resultsStore = [];
    submissionFinalized = false;

    await page.route('**/rest/v1/classes**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'e2e-class-1',
            name: CLASS_NAME,
            school_year: '2025/2026',
            created_date: '2026-05-22T00:00:00Z',
            created_at: '2026-05-22T00:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/rest/v1/students**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([studentRow]),
      });
    });

    await page.route('**/rest/v1/tests**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([testRow]),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/rest/v1/results**', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(resultsStore),
        });
        return;
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const rows = Array.isArray(body) ? body : [body];
        const insertedRows = rows.map((row, index) => ({
          id: `res-${resultsStore.length + index + 1}`,
          student_id: row.student_id,
          test_id: row.test_id,
          points: row.points,
          grade: row.grade,
          percentage: row.percentage,
          date_added: row.date_added ?? new Date().toISOString(),
          participated: row.participated ?? true,
          cancelled: row.cancelled ?? false,
          cancel_reason: row.cancel_reason ?? null,
          question_results: row.question_results ?? null,
          created_at: new Date().toISOString(),
        }));
        resultsStore.push(...insertedRows);
        const accept = route.request().headers()['accept'] ?? '';
        const payload =
          accept.includes('vnd.pgrst.object') && insertedRows.length === 1
            ? insertedRows[0]
            : insertedRows;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(payload),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/rest/v1/submissions**', async route => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET' && url.includes('status=eq.pending_review')) {
        if (submissionFinalized) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }
        if (url.includes(`test_id=eq.${TEST_ID}`)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([pendingSubmission]),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ test_id: TEST_ID }]),
        });
        return;
      }

      if (method === 'PATCH') {
        submissionFinalized = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ ...pendingSubmission, status: 'finalized' }]),
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/rest/v1/test_analytics**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('review submission, finalize, result appears in stats', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Тестове' }).click();

    const row = page.getByRole('row', { name: /E2E Review тест/ });
    await expect(row.getByRole('button', { name: 'Чака преглед (1)' })).toBeVisible();
    await row.getByRole('button', { name: 'Чака преглед (1)' }).click();

    const reviewModal = page.locator('.modal-content').filter({
      has: page.getByRole('heading', { name: /Преглед на предавания/ }),
    });
    await expect(
      reviewModal.getByRole('heading', { name: 'Иван Петров Георгиев' })
    ).toBeVisible();
    await expect(reviewModal.locator('#points-q1')).toBeVisible();
    await expect(reviewModal.locator('#points-q2')).toBeVisible();

    await reviewModal.locator('#points-q2').fill('4');
    await reviewModal.getByRole('button', { name: 'Финализирай' }).click({ force: true });
    await expect(reviewModal.getByText('Няма предавания, чакащи преглед.')).toBeVisible({
      timeout: 15000,
    });

    await reviewModal.getByRole('button', { name: 'Затвори' }).click();

    await expect(row.getByText('Чака преглед')).toHaveCount(0);
    await expect(row.getByText(/Резултати:.*1\/1/)).toBeVisible();
    await expect(row.getByText(/9.*т.*\/.*10/)).toBeVisible();

    await row.getByRole('button', { name: 'Редактирай резултати' }).click();
    const resultsModal = page.locator('.modal-content').filter({
      has: page.getByRole('heading', { name: 'Въвеждане на резултати' }),
    });
    await expect(resultsModal.getByText('Иван')).toBeVisible();
    await expect(resultsModal.locator('input[value="9"]')).toBeVisible();
  });
});
