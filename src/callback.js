const axios = require('axios');

const BACKEND_URLS = {
  local: ['http://localhost:5000/validation/receive/result'],
  prod: [
    'https://server-stage.pasv.us/validation/receive/result',
    'https://server-prod.pasv.us/validation/receive/result',
  ],
};

/**
 * Send validation result back to PASV backend.
 * Formats data in the same way the old validator did.
 */
async function sendResult({ userId, challengeId, results, totalTests, passedTests, isPassed, solution }) {
  const env = process.env.NODE_ENV || 'prod';
  const urls = BACKEND_URLS[env] || BACKEND_URLS.prod;

  // Build payload in the same format as the old validator's Mocha reporter
  const payload = [
    JSON.stringify({
      event: 'start',
      payload: { userId, challengeId, solution },
    }),
    ...results.map(r => JSON.stringify(r)),
    JSON.stringify({
      event: 'end',
      payload: { tests: totalTests, passes: passedTests },
    }),
  ];

  const promises = urls.map(url =>
    axios.post(url, payload).catch(err => {
      console.error(`Failed to send result to ${url}:`, err.message);
    })
  );

  await Promise.allSettled(promises);
}

module.exports = { sendResult };
