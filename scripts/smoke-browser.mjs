/** Launch the optional smoke browser, with an actionable missing-install error. */
export async function launchSmokeBrowser(chromium, options) {
  try { return await chromium.launch(options); }
  catch (error) {
    if (/executable (?:does not|doesn't) exist|executable.*not found/i.test(String(error?.message))) {
      throw new Error('Playwright Chromium is not installed or the configured executable is missing. Run `npx playwright install chromium`, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a valid Chromium executable.');
    }
    throw error;
  }
}
