// The README's screenshots are refreshed on purpose (UPDATE_SCREENSHOTS=1), never as a side effect of a test run.
export const SHOTS = process.env.UPDATE_SCREENSHOTS ? 'docs/screenshots' : 'test-results/screenshots';
