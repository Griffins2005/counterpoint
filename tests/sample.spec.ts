import { test, expect } from '@playwright/test'

test.describe('Sample investigation', () => {
  test('edits the sample board without calling a paid integration', async ({ page }) => {
    const paid: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/api/integrations/') || url.includes('/api/actions/')) paid.push(url)
    })
    await page.goto('/')
    const sample = page.getByTestId('sample-investigation')
    await expect(sample).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(sample.getByRole('heading', { name: /four-day workweek/ })).toBeVisible()

    const harbor = sample.getByTestId('source-card').filter({ hasText: 'Harbor Office Pilot' })
    await expect(harbor.getByText('https://example.com/counterpoint/sample/harbor-office')).toBeVisible()
    await harbor.getByRole('button', { name: 'Exclude' }).click()
    await expect(sample.getByText('The included sources or labels have changed since this synthesis.')).toBeVisible()

    const retail = sample.getByTestId('source-card').filter({ hasText: 'Retail Scheduling Audit' })
    await retail.getByRole('button', { name: 'Supporting' }).click()
    await retail.getByRole('button', { name: 'Restore' }).click()
    await expect(retail.getByRole('button', { name: 'Challenging' })).toHaveAttribute('aria-pressed', 'true')

    await sample.getByRole('button', { name: 'Update sample reading' }).click()
    const synthesis = sample.getByTestId('synthesis-panel')
    await expect(synthesis).not.toContainText('Harbor Office Pilot')
    await expect(synthesis).toContainText('No search ran and no model was called')
    expect(paid).toEqual([])
  })

  test('the signed-out desk does not submit an investigation', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('claim-input')).toBeVisible()
    await expect(page.getByTestId('investigate-button')).toHaveText('Sign in to investigate')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible()
    await expect(page.getByText('No investigations yet')).toHaveCount(0)
  })
})
