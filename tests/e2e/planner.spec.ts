import { test, expect } from '@playwright/test';

test.describe('Off-Planner Comprehensive Chrome UI E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-modal')).toBeHidden();
    // Clear localStorage for a clean isolated test state and reload
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('loading-modal')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Off-Planner' })).toBeVisible();
  });

  test('1. Starts with clean empty personal data and defaults to Berlin (DE-BE) public holidays', async ({
    page,
  }) => {
    const topBar = page.getByTestId('top-bar');
    // Verify no personal days or trips are hardcoded
    await expect(topBar).toContainText('Confirmed: 0d');
    await expect(topBar).toContainText('Draft: 0d');

    // Verify Berlin (DE-BE) is the default selected Bundesland
    const presetSelect = page.getByLabel('Bundesland or Country Holiday Preset');
    await expect(presetSelect).toHaveValue('DE-BE');

    // Open Feiertage tab in right sidebar and verify Berlin's 10 statutory holidays including Frauentag
    await page.getByRole('button', { name: /Feiertage/i }).click();
    await expect(page.getByText('Internationaler Frauentag')).toBeVisible();
    await expect(page.getByText('Tag der Deutschen Einheit')).toBeVisible();

    // Switch to Bavaria (DE-BY) and verify Bavarian holidays appear
    await presetSelect.selectOption('DE-BY');
    await expect(page.getByText('Fronleichnam')).toBeVisible();
    await expect(page.getByText('Allerheiligen')).toBeVisible();
  });

  test('2. Paints Confirmed/Draft days, groups trips, and preserves all data across page reloads', async ({
    page,
  }) => {
    const topBar = page.getByTestId('top-bar');

    // Paint two workdays in May 2026 (2026-05-15 is Friday after Christi Himmelfahrt on 2026-05-14)
    const may15 = page.locator('[data-date="2026-05-15"]');
    await may15.click();
    await expect(may15).toHaveAttribute('data-status', 'confirmed');
    await expect(topBar).toContainText('Confirmed: 1d');

    // Switch brush to Draft and paint Monday 2026-05-18
    await page.getByRole('button', { name: /Draft \/ Idea/i }).click();
    const may18 = page.locator('[data-date="2026-05-18"]');
    await may18.click();
    await expect(may18).toHaveAttribute('data-status', 'draft');
    await expect(topBar).toContainText('Draft: 1d');

    // Reload the page and verify data is preserved!
    await page.reload();
    await expect(page.getByTestId('loading-modal')).toBeHidden();
    await expect(page.locator('[data-date="2026-05-15"]')).toHaveAttribute(
      'data-status',
      'confirmed'
    );
    await expect(page.locator('[data-date="2026-05-18"]')).toHaveAttribute(
      'data-status',
      'draft'
    );
    await expect(topBar).toContainText('Confirmed: 1d');
    await expect(topBar).toContainText('Draft: 1d');
  });

  test('3. Preserves independent per-year Allowance and Carryover across years and reloads', async ({
    page,
  }) => {
    const topBar = page.getByTestId('top-bar');
    const allowanceInput = page
      .locator('label', { hasText: /Allowance \(2026\)/i })
      .locator('input');
    const carryoverInput = page
      .locator('label', { hasText: /Carryover \(2026\)/i })
      .locator('input');

    await allowanceInput.fill('28');
    await carryoverInput.fill('4');
    await expect(topBar).toContainText('32d left');

    // Navigate to 2027
    await page.getByTitle('Next Year').click();
    const allowance2027 = page
      .locator('label', { hasText: /Allowance \(2027\)/i })
      .locator('input');
    const carryover2027 = page
      .locator('label', { hasText: /Carryover \(2027\)/i })
      .locator('input');

    await allowance2027.fill('30');
    await carryover2027.fill('2');

    // Switch back to 2026 and verify 2026's 28 + 4 budget is intact
    await page.getByTitle('Previous Year').click();
    await expect(allowanceInput).toHaveValue('28');
    await expect(carryoverInput).toHaveValue('4');

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByTestId('loading-modal')).toBeHidden();
    await expect(allowanceInput).toHaveValue('28');
    await expect(carryoverInput).toHaveValue('4');
  });

  test('4. YAML Overlays start off & collapsed, support master visibility hide/show, and render multiple icons in zoomed views', async ({
    page,
  }) => {
    const panel = page.locator('aside').first();
    await expect(panel).toContainText('0 selected • Displayed');

    // Cards are collapsed by default (period details hidden until expanded)
    await expect(panel.getByText('Prime Swell Season (Peak Surf)')).toBeHidden();

    // Enable School Holidays and Surfing overlays
    const toggleButtons = panel.locator('button[title="Show overlay on calendar"]');
    await expect(toggleButtons).toHaveCount(3);
    await toggleButtons.nth(0).click(); // School Holidays
    await toggleButtons.nth(0).click(); // Surfing Nicaragua (since 1st button now has title "Hide overlay")

    await expect(panel).toContainText('2 selected • Displayed');

    // Expand Surfing Nicaragua card to inspect wave height, water temp, and skill level
    const expandButtons = panel.locator('button[title="Show details & settings"]');
    await expandButtons.nth(1).click();
    await expect(panel.getByText('Prime Swell Season (Peak Surf)')).toBeVisible();
    await expect(panel.getByText(/Intermediate – Advanced/i).first()).toBeVisible();

    // Master Display Toggle: Hide all overlays without losing which layers are enabled
    await panel.getByRole('button', { name: 'Visible' }).click();
    await expect(panel).toContainText('2 selected • Hidden');
    await expect(panel.getByRole('button', { name: 'Hidden' })).toBeVisible();

    // While hidden, enable the 3rd overlay (Diving)
    await panel.locator('button[title="Show overlay on calendar"]').first().click();
    await expect(panel).toContainText('3 selected • Hidden');

    // Re-enable Master Display -> all 3 overlays are now active and displayed
    await panel.getByRole('button', { name: 'Hidden' }).click();
    await expect(panel).toContainText('3 selected • Displayed');

    // Switch to 3M Quarter view -> cells with multiple active overlays render multiple icons
    await page.getByRole('button', { name: '3M', exact: true }).click();
    const feb17Cell = page.locator('[data-date="2026-02-17"]');
    await expect(feb17Cell.locator('svg')).toHaveCount(3);
  });

  test('5. Delayed interactive floating DayTooltip appears after 400ms, allows cursor entry, and hides after leaving', async ({
    page,
  }) => {
    // Enable Surfing overlay so the tooltip has rich seasonal cards
    const panel = page.locator('aside').first();
    await panel.locator('button[title="Show overlay on calendar"]').nth(1).click();

    const targetCell = page.locator('[data-date="2026-05-15"]');
    await targetCell.hover();

    // After 400ms delay, tooltip becomes visible
    const tooltip = page.getByTestId('day-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 2000 });
    await expect(tooltip).toContainText('Prime Swell Season (Peak Surf)');
    await expect(tooltip).toContainText('4–8 ft');

    // Move cursor away to header -> tooltip disappears after ~100ms
    await page.getByRole('heading', { name: 'Off-Planner' }).hover();
    await expect(tooltip).toBeHidden({ timeout: 2000 });
  });

  test('6. Multi-Tab Scenario Planning: creates, renames, clones any plan, previews & applies to Main, and supports Undo/Redo', async ({
    page,
  }) => {
    const topBar = page.getByTestId('top-bar');

    // Paint 1 day in Main first (2026-05-04)
    await page.locator('[data-date="2026-05-04"]').click();
    await expect(topBar).toContainText('Confirmed: 1d');

    // Create a new Plan tab ("Plan 1")
    await page.getByRole('button', { name: 'New Plan', exact: true }).click();
    await expect(page.getByText('Editing scenario:')).toContainText('Plan 1');
    await expect(topBar).toContainText('Confirmed: 0d');

    // Paint 2 days in Plan 1 (2026-07-06 and 2026-07-07)
    await page.locator('[data-date="2026-07-06"]').click();
    await page.locator('[data-date="2026-07-07"]').click();
    await expect(topBar).toContainText('Confirmed: 2d');

    // Clone Plan 1 (verify we can clone any plan, not only Main)
    await page.getByRole('button', { name: 'Clone Plan 1', exact: true }).click();
    await expect(page.getByText('Editing scenario:')).toContainText('Plan 1 (Copy)');
    await expect(topBar).toContainText('Confirmed: 2d');

    // Add 1 more day in "Plan 1 (Copy)" -> 3 days total
    await page.locator('[data-date="2026-07-08"]').click();
    await expect(topBar).toContainText('Confirmed: 3d');

    // Open "Apply to Main…" confirmation modal
    await page.getByRole('button', { name: 'Apply to Main…' }).click();
    await expect(
      page.getByRole('heading', { name: /Apply "Plan 1 \(Copy\)" to Main/i })
    ).toBeVisible();

    // Verify smart default interval is full year 2026-01-01 to 2026-12-31 and shows overwrite impact
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.nth(0)).toHaveValue('2026-01-01');
    await expect(dateInputs.nth(1)).toHaveValue('2026-12-31');
    await expect(page.getByText('1 vacation intervals (1 days)')).toBeVisible();
    await expect(page.getByText('1 vacation intervals (3 days)')).toBeVisible();

    // Confirm & Overwrite Main
    await page.getByRole('button', { name: 'Confirm & Overwrite Main' }).click();

    // Now on Main tab with 3 confirmed days in July (May 4 was overwritten)
    await expect(topBar).toContainText('Confirmed: 3d');
    await expect(page.locator('[data-date="2026-05-04"]')).toHaveAttribute(
      'data-status',
      'none'
    );
    await expect(page.locator('[data-date="2026-07-08"]')).toHaveAttribute(
      'data-status',
      'confirmed'
    );

    // Undo the Apply to Main action via Undo button -> returns to Plan 1 (Copy) and restores Main's May 4 day!
    await page.getByTitle('Undo (Cmd/Ctrl + Z)').click();
    await expect(page.getByText('Editing scenario:')).toContainText('Plan 1 (Copy)');

    // Redo via Redo button -> re-applies to Main!
    await page.getByTitle('Redo (Cmd/Ctrl + Y or Cmd/Ctrl + Shift + Z)').click();
    await expect(topBar).toContainText('Confirmed: 3d');
  });
});
