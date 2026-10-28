import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:5174'
const outputDir = new URL('../../docs/screenshots/multi-agent/', import.meta.url)
const reportPath = new URL('../../docs/MULTI_AGENT_BROWSER_QA.json', import.meta.url)
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(baseURL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '다중 인원 실험' }).click()
await page.getByLabel('S1 초기 인원').waitFor()
for (const id of ['S1', 'S2']) { await page.getByLabel(`${id} 초기 인원`).fill('0') }
await page.getByLabel('S3 초기 인원').fill('100')
await page.getByLabel('다중 인원 시나리오').selectOption('seoul-fire-b-stair')
const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/multi-agent/compare') && response.status() === 200)
await page.getByRole('button', { name: '차단 전후 비교 실행' }).click()
const response = await responsePromise
const api = await response.json()
await page.getByText('가정 조건 내 병목 후보').waitFor()
const resultText = await page.locator('.multi-output').innerText()
await page.screenshot({ path: fileURLToPath(new URL('01-s3-100-fire-b-1440x900.png', outputDir)), fullPage: true })
const desktop = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }))
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: fileURLToPath(new URL('02-s3-100-fire-b-390x844.png', outputDir)), fullPage: true })
const mobile = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth, mapWidth: document.querySelector('.map-viewport')?.scrollWidth }))
await writeFile(reportPath, JSON.stringify({ scenario: 'S3 100 fire B', api: api.scenario, resultText, desktop, mobile }, null, 2) + '\n')
await browser.close()
