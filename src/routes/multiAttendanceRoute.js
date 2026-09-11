const express = require("express");
const router = express.Router();
const { markAttendance } = require("../controllers/attendanceController");

// Mark route (handles check-in/check-out automatically)
router.patch("/mark", markAttendance);
router.post("/mark", markAttendance);

module.exports = router;
