const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const { env } = require("./config/env");
const { errorHandler, notFound } = require("./middleware/error");
const { apiRouter } = require("./routes");
const { HttpError } = require("./utils/httpError");

const app = express();
app.set("trust proxy", env.TRUST_PROXY);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"]
      }
    },
    hsts: env.NODE_ENV === "production"
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", (req, _res, next) => {
  if (env.INSTANT_CONFIGURED || req.path === "/health") {
    return next();
  }

  return next(
    new HttpError(
      503,
      "Backend is running without InstantDB credentials. Set INSTANT_APP_ID and INSTANT_ADMIN_TOKEN in backend/.env.",
      "INSTANT_NOT_CONFIGURED"
    )
  );
});
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
