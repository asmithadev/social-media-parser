function launchTestBrowser(chromium, options = {}) {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  });
}

module.exports = launchTestBrowser;
