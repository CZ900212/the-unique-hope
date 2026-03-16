const express = require("express");
const { healthRouter } = require("./health");
const { authRouter } = require("./auth");
const { adminRouter } = require("./admin");
const { teacherRouter } = require("./teacher");
const { studentRouter } = require("./student");
const { publicRouter } = require("./public");

const router = express.Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/teacher", teacherRouter);
router.use("/student", studentRouter);
router.use("/public", publicRouter);

module.exports = { apiRouter: router };
