const { init, id, tx } = require("@instantdb/admin");
const { env } = require("../config/env");
const { HttpError } = require("../utils/httpError");

function notConfiguredError() {
  return new HttpError(
    503,
    "InstantDB is not configured. Set INSTANT_APP_ID and INSTANT_ADMIN_TOKEN in backend/.env.",
    "INSTANT_NOT_CONFIGURED"
  );
}

function buildUnconfiguredDb() {
  const fail = () => {
    throw notConfiguredError();
  };

  return {
    query: fail,
    transact: fail,
    auth: {
      getUser: fail,
      createToken: fail,
      verifyToken: fail
    }
  };
}

const db = env.INSTANT_CONFIGURED
  ? init({
      appId: env.INSTANT_APP_ID,
      adminToken: env.INSTANT_ADMIN_TOKEN
    })
  : buildUnconfiguredDb();

module.exports = { db, id, tx };
