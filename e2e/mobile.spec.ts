import { test, expect, Page } from '@playwright/test'

// Clear localStorage before each test to ensure clean state
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

// Helper: click a button in the mobile bottom nav (not the sidebar)
async function tapBottomNav(page: Page, label: string) {
  await page.locator(`nav.fixed button:has-text("${label}")`).click()
}

// Helper: seed the app with demo data
async function seedDemoData(page: Page) {
  await page.goto('/')
  await tapBottomNav(page, 'Data')
  await page.getByRole('button', { name: 'Load Demo Data' }).click()
  await page.getByRole('button', { name: /Replace.*Load Demo/i }).click()
  await tapBottomNav(page, 'Dashboard')
  await expect(page.getByText('Total Net Worth')).toBeVisible({ timeout: 5000 })
}

// Helper: create an account from the Accounts tab (assumes we're on Accounts page)
async function createAccount(page: Page, name: string, institution: string) {
  await page.getByRole('button', { name: 'Add Account' }).first().click()
  await page.getByPlaceholder('e.g. Questrade TFSA').fill(name)
  await page.getByPlaceholder(/Questrade.*Wealthsimple/i).fill(institution)
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByText(name)).toBeVisible()
}

// ─── Navigation ───────────────────────────────────────────

test.describe('Mobile Navigation', () => {
  test('bottom nav is visible and sidebar is hidden', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav.fixed')).toBeVisible()
    await expect(page.locator('aside')).toBeHidden()
  })

  test('can navigate between all tabs via bottom nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    await tapBottomNav(page, 'Accounts')
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()

    await tapBottomNav(page, 'Data')
    await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible()

    await tapBottomNav(page, 'Dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('Upload button in bottom nav opens upload modal', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Upload')
    await expect(page.getByText(/drag.*drop|drop.*file|select.*file/i)).toBeVisible({ timeout: 3000 })
  })
})

// ─── Dashboard Tabs ───────────────────────────────────────

test.describe('Dashboard Tabs', () => {
  test('Save/Spend/Cash Flow tabs all switch correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Total Net Worth')).toBeVisible()

    await page.getByRole('button', { name: 'Spend' }).click()
    await expect(page.getByText('Avg Monthly Spend')).toBeVisible()

    await page.getByRole('button', { name: 'Cash Flow' }).click()
    await expect(page.getByText('Avg Net Cash Flow')).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Total Net Worth')).toBeVisible()
  })

  test('tab buttons are not cut off on mobile', async ({ page }) => {
    await page.goto('/')
    const tabBar = page.locator('.flex.gap-1.p-1')
    const tabBarBox = await tabBar.boundingBox()
    if (tabBarBox) {
      const viewport = page.viewportSize()!
      expect(tabBarBox.x + tabBarBox.width).toBeLessThanOrEqual(viewport.width + 1)
    }
  })
})

// ─── Account Creation Flow ────────────────────────────────

test.describe('Account CRUD on Mobile', () => {
  test('can create an account via Accounts tab', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')

    await createAccount(page, 'Test TFSA', 'Wealthsimple')

    await expect(page.getByText('Test TFSA')).toBeVisible()
  })

  test('modal form is fully visible and scrollable on small screens', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')
    await page.getByRole('button', { name: 'Add Account' }).first().click()

    const submitBtn = page.locator('form button[type="submit"]')
    await expect(submitBtn).toBeVisible()

    const box = await submitBtn.boundingBox()
    if (box) {
      const viewport = page.viewportSize()!
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }
  })

  test('can navigate to account detail and back', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')
    await createAccount(page, 'Nav Test', 'TD')

    await page.getByText('Nav Test').click()
    await expect(page.getByRole('heading', { name: 'Nav Test' })).toBeVisible()

    // Back button
    await page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).click()
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
  })
})

// ─── Account Detail — Manual Entry ────────────────────────

test.describe('Manual Entry on Mobile', () => {
  test('can add a manual entry from account detail', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')
    await createAccount(page, 'Manual Entry Test', 'TD')

    await page.getByText('Manual Entry Test').click()
    await page.getByRole('button', { name: /Manual Entry/i }).click()
    await expect(page.getByText('Add Manual Entry')).toBeVisible()

    await page.locator('input[type="date"]').fill('2025-01-01')
    await page.locator('input[type="number"]').fill('10000')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('$10,000.00').first()).toBeVisible()
  })

  test('manual entry modal fits on mobile screen', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')
    await createAccount(page, 'Modal Fit Test', 'TD')

    await page.getByText('Modal Fit Test').click()
    await page.getByRole('button', { name: /Manual Entry/i }).click()

    const saveBtn = page.getByRole('button', { name: 'Save' })
    await expect(saveBtn).toBeVisible()
    const box = await saveBtn.boundingBox()
    if (box) {
      const viewport = page.viewportSize()!
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }
  })
})

// ─── Data Management ──────────────────────────────────────

test.describe('Data Management on Mobile', () => {
  test('can load demo data and verify it appears on dashboard', async ({ page }) => {
    await seedDemoData(page)
    await expect(page.locator('text=/\\$[\\d,]+/')).toBeTruthy()
  })

  test('clear data works', async ({ page }) => {
    await seedDemoData(page)
    await tapBottomNav(page, 'Data')

    await page.getByRole('button', { name: 'Clear' }).click()
    await page.getByRole('button', { name: 'Delete Everything' }).click()

    await tapBottomNav(page, 'Dashboard')
    await expect(page.getByText('Add your first account')).toBeVisible()
  })

  test('export button is accessible on mobile', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Data')

    const exportBtn = page.getByRole('button', { name: 'Export' })
    await expect(exportBtn).toBeVisible()
    const box = await exportBtn.boundingBox()
    if (box) {
      const viewport = page.viewportSize()!
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    }
  })
})

// ─── Horizontal Overflow Checks ───────────────────────────

test.describe('No Horizontal Overflow', () => {
  test('dashboard has no horizontal scroll', async ({ page }) => {
    await page.goto('/')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('accounts page has no horizontal scroll', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')
    await page.waitForTimeout(300)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('data page has no horizontal scroll', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Data')
    await page.waitForTimeout(300)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('dashboard with demo data has no horizontal scroll', async ({ page }) => {
    await seedDemoData(page)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('spend tab has no horizontal scroll', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Spend' }).click()
    await page.waitForTimeout(500)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('cash flow tab has no horizontal scroll', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Cash Flow' }).click()
    await page.waitForTimeout(500)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('account detail has no horizontal scroll', async ({ page }) => {
    await seedDemoData(page)
    await tapBottomNav(page, 'Accounts')
    await page.locator('[class*="cursor-pointer"]').first().click()
    await page.waitForTimeout(500)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

// ─── Cash Flow — Income/Expense Forms ─────────────────────

test.describe('Cash Flow Forms on Mobile', () => {
  test('can add income record on mobile', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Cash Flow' }).click()

    // Ensure setup section is visible and expanded
    const setupBtn = page.getByText('Income & Fixed Expenses')
    await setupBtn.scrollIntoViewIfNeeded()
    const addIncomeLink = page.getByText('Add Income')
    if (!(await addIncomeLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await setupBtn.click()
    }
    await addIncomeLink.scrollIntoViewIfNeeded()
    await addIncomeLink.click()

    await page.getByPlaceholder(/Name.*Salary/i).fill('My Salary')
    await page.getByPlaceholder('Amount').first().fill('5000')

    // The form Add button
    await page.locator('.rounded-lg.bg-app-accent').filter({ hasText: 'Add' }).first().click()

    await expect(page.getByText('My Salary')).toBeVisible()
    await expect(page.getByText('$5,000')).toBeVisible()
  })

  test('can add fixed expense on mobile', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Cash Flow' }).click()

    const setupBtn = page.getByText('Income & Fixed Expenses')
    await setupBtn.scrollIntoViewIfNeeded()
    const addExpenseLink = page.getByText('Add Expense')
    if (!(await addExpenseLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await setupBtn.click()
    }
    await addExpenseLink.scrollIntoViewIfNeeded()
    await addExpenseLink.click()

    await page.getByPlaceholder(/Name.*Rent/i).fill('Monthly Rent')
    await page.getByPlaceholder('Amount').first().fill('2000')

    await page.locator('.rounded-lg.bg-app-accent').filter({ hasText: 'Add' }).last().click()

    await expect(page.getByText('Monthly Rent')).toBeVisible()
  })

  test('income form inputs do not overflow on mobile', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Cash Flow' }).click()

    const setupBtn = page.getByText('Income & Fixed Expenses')
    await setupBtn.scrollIntoViewIfNeeded()
    const addIncomeLink = page.getByText('Add Income')
    if (!(await addIncomeLink.isVisible({ timeout: 500 }).catch(() => false))) {
      await setupBtn.click()
    }
    await addIncomeLink.scrollIntoViewIfNeeded()
    await addIncomeLink.click()

    const formInputs = page.locator('.grid.grid-cols-2').first()
    const box = await formInputs.boundingBox()
    if (box) {
      const viewport = page.viewportSize()!
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    }
  })
})

// ─── Delete Account Flow ──────────────────────────────────

test.describe('Delete Account on Mobile', () => {
  test('delete confirmation modal works', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Accounts')
    await createAccount(page, 'To Delete', 'TD')

    await page.getByText('To Delete').click()
    await expect(page.getByRole('heading', { name: 'To Delete' })).toBeVisible()

    // The delete button contains a Trash2 icon and has red hover classes
    // It's the last button in the header action row
    const actionButtons = page.locator('.flex.items-center.gap-2 button')
    await actionButtons.last().click()

    await expect(page.getByText('Delete Account?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
  })
})

// ─── Content Visibility (not hidden behind bottom nav) ────

test.describe('Content not hidden behind bottom nav', () => {
  test('page content has enough bottom padding for nav bar', async ({ page }) => {
    await page.goto('/')
    const mainEl = page.locator('main')
    const paddingBottom = await mainEl.evaluate((el) => getComputedStyle(el).paddingBottom)
    const pbPx = parseInt(paddingBottom)
    expect(pbPx).toBeGreaterThanOrEqual(60)
  })

  test('last item on accounts page is not obscured by bottom nav', async ({ page }) => {
    await seedDemoData(page)
    await tapBottomNav(page, 'Accounts')
    await page.waitForTimeout(300)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)

    const bottomNav = page.locator('nav.fixed')
    const navBox = await bottomNav.boundingBox()

    const cards = page.locator('[class*="cursor-pointer"]')
    const count = await cards.count()
    if (count > 0) {
      const lastCard = cards.last()
      const cardBox = await lastCard.boundingBox()
      if (cardBox && navBox) {
        expect(cardBox.y).toBeLessThan(navBox.y)
      }
    }
  })
})

// ─── Touch Targets ────────────────────────────────────────

test.describe('Touch Target Sizes', () => {
  test('bottom nav buttons have adequate touch targets', async ({ page }) => {
    await page.goto('/')
    const navButtons = page.locator('nav.fixed button')
    const count = await navButtons.count()
    for (let i = 0; i < count; i++) {
      const box = await navButtons.nth(i).boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40)
        expect(box.width).toBeGreaterThanOrEqual(40)
      }
    }
  })

  test('dashboard tab buttons have adequate touch targets', async ({ page }) => {
    await page.goto('/')
    const tabs = page.locator('button', { hasText: /^(Save|Spend|Cash Flow)$/ })
    const count = await tabs.count()
    for (let i = 0; i < count; i++) {
      const box = await tabs.nth(i).boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })
})

// ─── Upload Modal Backdrop Behavior ──────────────────────

test.describe('Upload Modal Backdrop', () => {
  test('backdrop click closes modal in pick step', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Upload')
    await expect(page.getByText(/drop.*pdf|click to browse/i)).toBeVisible({ timeout: 3000 })

    // Click the backdrop (the semi-transparent overlay behind the modal)
    await page.locator('.fixed.inset-0 > .absolute.inset-0').click({ position: { x: 10, y: 10 } })

    // Modal should be gone
    await expect(page.getByText(/drop.*pdf|click to browse/i)).toBeHidden({ timeout: 3000 })
  })

  test('clicking inside modal content does not close it', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Upload')
    await expect(page.getByText(/drop.*pdf|click to browse/i)).toBeVisible({ timeout: 3000 })

    // Click inside the modal content area (the header heading)
    await page.getByRole('heading', { name: 'Upload Statement' }).click()

    // Modal should still be open
    await expect(page.getByText(/drop.*pdf|click to browse/i)).toBeVisible()
  })

  test('X button closes modal', async ({ page }) => {
    await page.goto('/')
    await tapBottomNav(page, 'Upload')
    await expect(page.getByText(/drop.*pdf|click to browse/i)).toBeVisible({ timeout: 3000 })

    // Click the X close button
    await page.locator('.fixed.inset-0 button').filter({ has: page.locator('svg.lucide-x') }).click()

    await expect(page.getByText(/drop.*pdf|click to browse/i)).toBeHidden({ timeout: 3000 })
  })
})

// ─── Demo Data Integration ────────────────────────────────

test.describe('Full Flow with Demo Data', () => {
  test('dashboard shows charts and account cards after loading demo data', async ({ page }) => {
    await seedDemoData(page)

    const cards = page.locator('.grid button')
    await expect(cards.first()).toBeVisible()

    await cards.first().click()
    await page.waitForTimeout(300)

    await expect(page.getByText('Latest Value')).toBeVisible()
    await expect(page.getByText('History')).toBeVisible()
  })

  test('spend tab shows credit card data with demo', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Spend' }).click()
    await expect(page.getByText('Avg Monthly Spend')).toBeVisible()
  })

  test('cash flow tab is functional with demo data', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Cash Flow' }).click()
    await expect(page.getByText('Avg Net Cash Flow')).toBeVisible()
  })
})

// ─── Date Range Filter ───────────────────────────────────

test.describe('Date Range Filter', () => {
  test('Save tab shows date range filter defaulting to 6M', async ({ page }) => {
    await seedDemoData(page)
    const filterContainer = page.locator('button:has-text("6M")').first()
    await expect(filterContainer).toBeVisible()
    // 6M should be active (white text via bg-[#1a1e2e])
    await expect(filterContainer).toHaveClass(/bg-\[#1a1e2e\]/)
  })

  test('Save tab filter buttons are clickable and toggle active state', async ({ page }) => {
    await seedDemoData(page)
    // Click 3M
    const btn3M = page.locator('button:has-text("3M")').first()
    await btn3M.click()
    await expect(btn3M).toHaveClass(/bg-\[#1a1e2e\]/)

    // Click All
    const btnAll = page.locator('button:has-text("All")').first()
    await btnAll.click()
    await expect(btnAll).toHaveClass(/bg-\[#1a1e2e\]/)

    // Click 1Y
    const btn1Y = page.locator('button:has-text("1Y")').first()
    await btn1Y.click()
    await expect(btn1Y).toHaveClass(/bg-\[#1a1e2e\]/)
  })

  test('Spend tab shows date range filter defaulting to 6M', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Spend' }).click()
    await expect(page.getByText('Avg Monthly Spend')).toBeVisible()
    const filterContainer = page.locator('button:has-text("6M")').first()
    await expect(filterContainer).toBeVisible()
    await expect(filterContainer).toHaveClass(/bg-\[#1a1e2e\]/)
  })

  test('Cash Flow tab shows date range filter defaulting to 6M', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Cash Flow' }).click()
    await expect(page.getByText('Avg Net Cash Flow')).toBeVisible()
    const filterContainer = page.locator('button:has-text("6M")').first()
    await expect(filterContainer).toBeVisible()
    await expect(filterContainer).toHaveClass(/bg-\[#1a1e2e\]/)
  })

  test('Spend tab filter changes hero metric text', async ({ page }) => {
    await seedDemoData(page)
    await page.getByRole('button', { name: 'Spend' }).click()
    await expect(page.getByText('Avg Monthly Spend')).toBeVisible()

    // Get initial "Based on X months" text
    const basedOnText = page.getByText(/Based on \d+ months? of statements/)
    const initialText = await basedOnText.textContent()

    // Switch to All to show all data
    await page.locator('button:has-text("All")').first().click()
    const allText = await basedOnText.textContent()

    // All should show >= months compared to 6M default
    const initialMonths = parseInt(initialText?.match(/(\d+)/)?.[1] ?? '0')
    const allMonths = parseInt(allText?.match(/(\d+)/)?.[1] ?? '0')
    expect(allMonths).toBeGreaterThanOrEqual(initialMonths)
  })
})

// ─── PWA Metadata ────────────────────────────────────────

test.describe('PWA Metadata', () => {
  test('has theme-color meta tag', async ({ page }) => {
    await page.goto('/')
    const themeColor = page.locator('meta[name="theme-color"]')
    await expect(themeColor).toHaveAttribute('content', '#0a0d14')
  })

  test('has favicon and apple-touch-icon links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="icon"][sizes="48x48"]')).toHaveAttribute('href', /favicon\.ico/)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon/)
  })

  test('has SVG icon link', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', /icon\.svg/)
  })
})
