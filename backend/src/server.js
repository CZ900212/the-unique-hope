const { env } = require("./config/env");
const { app } = require("./app");

app.listen(env.PORT, () => {
  if (!env.INSTANT_CONFIGURED) {
    // eslint-disable-next-line no-console
    console.warn(
      "InstantDB credentials are missing. API is running in degraded mode; only /api/health is available."
    );
  }
  // eslint-disable-next-line no-console
  console.log(`API listening on :${env.PORT}`);
});
