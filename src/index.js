const express = require('express');
const morgan = require('morgan');
const { runInIsolate } = require('./isolate-runner');
const { validateEqual } = require('./equal-validator');
const { sendResult } = require('./callback');

const PORT = +process.env.PORT || 7000;
const app = express();

app.disable('x-powered-by');
app.use(morgan('short'));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/test', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Unit validator — runs JS code in V8 isolate
app.post('/validate/unit/place', async (req, res) => {
  const { solution, test, userId, challengeId, programmingLang } = req.body;

  if (!solution && !test) {
    return res.status(400).json({
      success: false,
      message: 'Missing solution or test',
    });
  }

  if (programmingLang && programmingLang !== 'JavaScript') {
    return res.status(400).json({
      success: false,
      message: `Language ${programmingLang} is not yet supported`,
    });
  }

  try {
    const result = await runInIsolate(solution || '', test || '');

    // Send result to backend asynchronously (don't wait)
    sendResult({
      userId,
      challengeId,
      results: result.results,
      totalTests: result.totalTests,
      passedTests: result.passedTests,
      isPassed: result.isPassed,
      solution,
    }).catch(err => console.error('Callback error:', err.message));

    res.status(200).json({
      success: true,
      message: 'Container has been created and result has been sent.',
      payload: null,
    });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(400).json({
      success: false,
      message: 'There is an issue with container creation.',
    });
  }
});

// Equal validator — simple string comparison
app.post('/validate/equal', (req, res) => {
  const { solution, completedSolution } = req.body;
  const warnings = validateEqual(solution, completedSolution);

  res.status(200).json({
    success: true,
    message: warnings[0]?.type === 'passed' ? 'Everything is good' : 'Warnings',
    payload: warnings,
  });
});

app.listen(PORT, () => {
  console.log(`PASV Validator running on port ${PORT} (env: ${process.env.NODE_ENV || 'production'})`);
});

module.exports = app;
