import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const outputDir = new URL('../../docs/screenshots/final-results/', import.meta.url)
const reportPath = new URL('../../docs/FINAL_VISUAL_QA.json', import.meta.url)
const mapId = 'seoul-station-line4-prototype-v1'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const report = []
await mkdir(outputDir, { recursive: true })

async function prepare(scenarioId, { start = 'S3' } = {}) {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.selectOption('[aria-label="지도 선택"]', mapId)
  await page.getByTestId('node-S3').waitFor()
  await page.selectOption('[aria-label="시나리오 선택"]', scenarioId)
  if (scenarioId === 'baseline') await page.selectOption('[aria-label="시작 위치 선택"]', start)
}

async function calculate(name, scenarioId) {
  await prepare(scenarioId)
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/routes/compare') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '기본 경로와 비교' }).click()
  const response = await responsePromise
  const api = await response.json()
  await page.getByRole('button', { name: '변경하기' }).waitFor()
  const results = await page.getByRole('region', { name: '계산 결과' }).innerText()
  const scenarioPathCount = await page.locator('.route-scenario').count()
  const baselinePathCount = await page.locator('.route-baseline').count()
  const measurements = name === '01-s3-baseline' ? await page.evaluate(() => {
    const rect = (selector) => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box && { width: box.width, height: box.height, x: box.x, y: box.y } }
    const style = (selector) => { const element = document.querySelector(selector); if (!element) return null; const css = getComputedStyle(element); return { fontFamily: css.fontFamily, fontSize: css.fontSize, fontWeight: css.fontWeight, padding: css.padding, gap: css.gap, borderRadius: css.borderRadius } }
    return { appShell: rect('.app-shell'), workspace: rect('.workspace'), mapColumn: rect('.map-column'), mapCanvas: rect('.map-canvas'), sideColumn: rect('.side-column'), conditionPanel: rect('.condition-panel'), resultPanel: rect('.results'), routeCard: rect('.route-card'), workspaceStyle: style('.workspace'), panelStyle: style('.panel'), routeCardStyle: style('.route-card') }
  }) : undefined
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, outputDir)), fullPage: true })
  report.push({ name, scenarioId, api, results, scenarioPathCount, baselinePathCount, measurements })
}

await calculate('01-s3-baseline', 'baseline')
await calculate('02-s3-fire-a', 'seoul-fire-a-approach')
await calculate('03-s3-fire-b', 'seoul-fire-b-stair')
await calculate('04-exit-11-closed', 'seoul-fire-a-exit')
await calculate('05-unreachable-stairs-a-b', 'seoul-fire-b-unreachable')

await prepare('seoul-fire-a-approach')
let responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/routes/compare'))
await page.getByRole('button', { name: '기본 경로와 비교' }).click()
await responsePromise
await page.getByRole('button', { name: '변경하기' }).click()
await page.getByLabel('출발 반응시간').fill('10')
await page.getByText(/이전 결과를 지웠습니다/).waitFor()
await page.screenshot({ path: fileURLToPath(new URL('06-condition-changed.png', outputDir)), fullPage: true })
report.push({ name: '06-condition-changed', scenarioPathCount: await page.locator('.route-scenario').count(), staleNotice: await page.getByText(/이전 결과를 지웠습니다/).innerText() })

await prepare('baseline')
await page.getByLabel('평지 이동속도').fill('0')
await page.getByText('0보다 크고 10 이하인 값을 입력해 주세요.').waitFor()
await page.screenshot({ path: fileURLToPath(new URL('07-input-error.png', outputDir)), fullPage: true })
report.push({ name: '07-input-error', compareDisabled: await page.getByRole('button', { name: '기본 경로와 비교' }).isDisabled() })

await prepare('baseline')
let loadingCalls = 0
await page.route('**/api/routes/compare', async (route) => { loadingCalls += 1; await new Promise((resolve) => setTimeout(resolve, 350)); await route.continue() }, { times: 1 })
const compareButton = page.locator('.button-row button').last()
await compareButton.click()
const disabledDuringLoading = await compareButton.isDisabled()
await compareButton.click({ force: true })
await page.getByRole('button', { name: '변경하기' }).waitFor()
report.push({ name: 'loading-duplicate-guard', disabledDuringLoading, loadingCalls })

await prepare('seoul-fire-a-approach')
await page.route('**/api/routes/compare', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'QA forced API failure' }) }), { times: 1 })
await page.getByRole('button', { name: '기본 경로와 비교' }).click()
await page.getByRole('alert').waitFor()
await page.screenshot({ path: fileURLToPath(new URL('08-api-error.png', outputDir)), fullPage: true })
const errorText = await page.getByRole('alert').innerText()
responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/routes/compare') && response.status() === 200)
await page.getByRole('button', { name: '다시 시도' }).click()
const retryResponse = await responsePromise
await page.getByRole('button', { name: '변경하기' }).waitFor()
await page.screenshot({ path: fileURLToPath(new URL('09-api-retry-success.png', outputDir)), fullPage: true })
report.push({ name: '08-api-error-and-retry', errorText, retryStatus: retryResponse.status(), results: await page.getByRole('region', { name: '계산 결과' }).innerText() })

await page.setViewportSize({ width: 390, height: 844 })
await prepare('seoul-fire-a-approach')
responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/routes/compare'))
await page.getByRole('button', { name: '기본 경로와 비교' }).click()
await responsePromise
await page.getByRole('button', { name: '변경하기' }).waitFor()
const overflow = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth, mapViewport: document.querySelector('.map-viewport')?.scrollWidth }))
await page.screenshot({ path: fileURLToPath(new URL('10-mobile-fire-a-390x844.png', outputDir)), fullPage: true })
report.push({ name: '10-mobile-fire-a-390x844', overflow })

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
await browser.close()
