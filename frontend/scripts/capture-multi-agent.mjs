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

const setCounts = async (s3) => {
  await page.getByLabel('S1 초기 인원').fill('0')
  await page.getByLabel('S2 초기 인원').fill('0')
  await page.getByLabel('S3 초기 인원').fill(String(s3))
}

const run = async ({ scenario, s3, maxTime }) => {
  await setCounts(s3)
  await page.getByLabel('다중 인원 시나리오').selectOption(scenario)
  await page.getByLabel('최대 모의 시간').fill(String(maxTime))
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/multi-agent/compare') && response.status() === 200)
  await page.getByRole('button', { name: '차단 전후 비교 실행' }).click()
  const response = await responsePromise
  const api = await response.json()
  await page.getByText('차단 전후 한눈에 비교').waitFor()
  return { api, resultText: await page.locator('.multi-output').innerText() }
}

const fireB = await run({ scenario: 'seoul-fire-b-stair', s3: 100, maxTime: 3600 })
await page.getByText('모든 인원이 도착했습니다').last().waitFor()
await page.screenshot({ path: fileURLToPath(new URL('03-results-improved-fire-b-1440x900.png', outputDir)), fullPage: true })
const desktop = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }))

const noRoute = await run({ scenario: 'seoul-fire-b-unreachable', s3: 100, maxTime: 3600 })
await page.getByText('이용 가능한 경로가 없습니다').last().waitFor()
await page.screenshot({ path: fileURLToPath(new URL('04-results-no-route-1440x900.png', outputDir)), fullPage: true })

const timeout = await run({ scenario: 'baseline', s3: 300, maxTime: 60 })
await page.getByText('제한시간에 실험이 종료됐습니다').last().waitFor()
await page.screenshot({ path: fileURLToPath(new URL('05-results-timeout-1440x900.png', outputDir)), fullPage: true })

await run({ scenario: 'seoul-fire-b-stair', s3: 100, maxTime: 3600 })
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: fileURLToPath(new URL('06-results-improved-fire-b-390x844.png', outputDir)), fullPage: true })
const mobile = await page.evaluate(() => ({
  bodyWidth: document.body.scrollWidth,
  viewportWidth: innerWidth,
  mapWidth: document.querySelector('.map-viewport')?.scrollWidth,
}))

await writeFile(reportPath, JSON.stringify({
  scenarios: {
    fire_b: { api: fireB.api.scenario, resultText: fireB.resultText },
    no_route: { api: noRoute.api.scenario, resultText: noRoute.resultText },
    timeout: { api: timeout.api.scenario, resultText: timeout.resultText },
  },
  rawStatusCodesExposed: [fireB, noRoute, timeout].some(({ resultText }) => /ALL_REACHABLE_AGENTS_ARRIVED|NO_REACHABLE_ROUTES|TIMEOUT_WITH_ACTIVE_AGENTS/.test(resultText)),
  desktop,
  mobile,
}, null, 2) + '\n')
await browser.close()
