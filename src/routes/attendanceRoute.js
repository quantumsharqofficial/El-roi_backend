const express = require("express");
const router = express.Router();
const {
  checkIn,
  checkOut,
  getEmployee,
  getAttendanceByDate,
  getByDateAndEmploueeId,
  getMonthlyAttendanceSummary,
} = require("../controllers/attendanceController");

// Check-in route
router.post("/check-in", checkIn);

// Check-out route
router.patch("/check-out", checkOut);

// Route to get monthly attendance summary (must be before /:employeeID)
router.get("/monthly-summary", getMonthlyAttendanceSummary);

// Route to get all data by date range
router.get("/find-date/:date", getAttendanceByDate);

// Route to get an employee's records
router.get("/:employeeID", getEmployee);

// Route to get a specific employee record by date and ID
router.post("/datebyemployeeid", getByDateAndEmploueeId);

module.exports = router;
