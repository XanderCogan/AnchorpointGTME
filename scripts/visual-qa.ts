import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright-core";

const baseUrl = process.env.ANCHORPOINT_QA_URL ?? "http://localhost:3000";
const expectFailedJob = process.argv.includes("--expect-failed-job");
const browserCandidates = [
  process.env.ANCHORPOINT_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((candidate): candidate is string => Boolean(candidate));

const executablePath = browserCandidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  throw new Error(
    "No supported local Chromium browser was found. Set ANCHORPOINT_BROWSER_PATH and retry.",
  );
}

const outputDirectory = resolve("artifacts", "milestone-2-visual-qa");
mkdirSync(outputDirectory, { recursive: true });

async function assertPageBasics(page: Page, viewportName: string) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  if (new URL(page.url()).pathname === "/login") {
    await page.getByLabel("Work email").fill(
      process.env.DEMO_USER_EMAIL ?? "revops@anchorpoint.example",
    );
    await page.getByLabel("Password").fill(
      process.env.DEMO_USER_PASSWORD ?? "anchorpoint-local",
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(baseUrl);
  }
  await page.getByRole("heading", { level: 1 }).waitFor();

  const jobStrip = page.locator('section[aria-label="Application job status"]');
  await jobStrip.locator(`.job-state.${expectFailedJob ? "failed" : "succeeded"}`).waitFor();
  if (expectFailedJob) {
    const jobText = (await jobStrip.textContent()) ?? "";
    if (!jobText.includes("crm-audit job is missing fixtureReleaseId.")) {
      throw new Error(`${viewportName}: failed job error is not visible.`);
    }
    if (!jobText.includes("3/3 attempts")) {
      throw new Error(`${viewportName}: failed job attempt count is not visible.`);
    }
  }

  const heading = await page.getByRole("heading", { level: 1 }).textContent();
  if (heading?.trim() !== "Fix what blocks safe growth.") {
    throw new Error(`${viewportName}: unexpected primary heading: ${heading ?? "missing"}`);
  }

  const findings = page.locator(".finding");
  if ((await findings.count()) !== 22) {
    throw new Error(`${viewportName}: expected 22 findings.`);
  }

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  if (overflow.documentWidth > overflow.viewportWidth) {
    throw new Error(
      `${viewportName}: horizontal overflow (${overflow.documentWidth}px > ${overflow.viewportWidth}px).`,
    );
  }

  await findings.first().locator("summary").click();
  await findings.first().locator(".finding-detail").waitFor({ state: "visible" });

}

const browser = await chromium.launch({ executablePath, headless: true });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await assertPageBasics(desktop, "desktop");
  await desktop.screenshot({
    path: resolve(outputDirectory, expectFailedJob ? "desktop-failed-job.png" : "desktop.png"),
    fullPage: true,
  });

  await desktop.getByRole("button", { name: /Critical/ }).click();
  if ((await desktop.locator(".finding").count()) !== 15) {
    throw new Error("desktop: the critical filter did not return 15 findings.");
  }

  await desktop.getByRole("button", { name: /All issues/ }).click();
  await desktop.getByRole("searchbox").fill("Blue Ridge");
  if ((await desktop.locator(".finding").count()) === 0) {
    throw new Error("desktop: search returned no findings for a known fixture record.");
  }

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
  });
  await assertPageBasics(mobile, "mobile");
  await mobile.screenshot({
    path: resolve(outputDirectory, expectFailedJob ? "mobile-failed-job.png" : "mobile.png"),
    fullPage: true,
  });

  console.log(`Visual QA passed. Screenshots: ${outputDirectory}`);
} finally {
  await browser.close();
}
