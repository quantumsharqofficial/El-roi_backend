const express = require("express");
const router = express.Router();
const {
  getAllByMonth,
  findDate,
  findByEmployeeId,
  getMonthByEmployeeId,
  getDateByEmployeeId,
  markNewAttendance,
} = require("../controllers/newAttendanceController");
const { getMonthlyAttendanceSummary } = require("../controllers/attendanceController");

// ─── Mark Attendance (Multi-Shift Check-In / Check-Out) ──────────────────────
router.post("/mark", markNewAttendance);
router.patch("/mark", markNewAttendance);

// ─── Monthly Summary Route ───────────────────────────────────────────────────
router.get("/monthly-summary", getMonthlyAttendanceSummary);
router.get("/monthly-summary/:month", (req, res) => {
  req.query.month = req.params.month || req.query.month;
  return getMonthlyAttendanceSummary(req, res);
});
router.get("/monthlysummary", getMonthlyAttendanceSummary);
router.get("/monthlysummary/:month", (req, res) => {
  req.query.month = req.params.month || req.query.month;
  return getMonthlyAttendanceSummary(req, res);
});

// ─── 1. Get All By Month ─────────────────────────────────────────────────────
// Matches: /getallbymonth, /getallbymonth/:month, /all-by-month, /all-by-month/:month
router.get("/getallbymonth", getAllByMonth);
router.get("/getallbymonth/:month", getAllByMonth);
router.get("/all-by-month", getAllByMonth);
router.get("/all-by-month/:month", getAllByMonth);
router.post("/getallbymonth", getAllByMonth);

// ─── 2. Find By Date ─────────────────────────────────────────────────────────
// Matches: /finddate, /finddate/:date, /find-date, /find-date/:date
router.get("/finddate", findDate);
router.get("/finddate/:date", findDate);
router.get("/find-date", findDate);
router.get("/find-date/:date", findDate);
router.post("/finddate", findDate);
router.post("/find-date", findDate);

// ─── 3. Month By Employee ID ─────────────────────────────────────────────────
// Matches: /monthbyemployeeid/:employeeID/:month, /monthbyemployeeid/:employeeID, /monthbyemployeeid
// (Defined before /:employeeID to avoid route conflicts)
router.get("/monthbyemployeeid/:employeeID/:month", getMonthByEmployeeId);
router.get("/monthbyemployeeid/:employeeID", getMonthByEmployeeId);
router.get("/monthbyemployeeid", getMonthByEmployeeId);
router.post("/monthbyemployeeid", getMonthByEmployeeId);
router.get("/month-by-employee/:employeeID", getMonthByEmployeeId);

// ─── 4. Date By Employee ID ──────────────────────────────────────────────────
// Matches: /datebyemployeeid/:employeeID/:date, /datebyemployeeid/:employeeID, /datebyemployeeid
// (Defined before /:employeeID to avoid route conflicts)
router.get("/datebyemployeeid/:employeeID/:date", getDateByEmployeeId);
router.get("/datebyemployeeid/:employeeID", getDateByEmployeeId);
router.get("/datebyemployeeid", getDateByEmployeeId);
router.post("/datebyemployeeid", getDateByEmployeeId);
router.get("/date-by-employee/:employeeID", getDateByEmployeeId);

// ─── 5. Find By Employee ID ───────────────────────────────────────────────────
// Matches: /findbyemployeeid/:employeeID, /findbyemployeeid, /employee/:employeeID, /:employeeID
router.get("/findbyemployeeid/:employeeID", findByEmployeeId);
router.get("/findbyemployeeid", findByEmployeeId);
router.post("/findbyemployeeid", findByEmployeeId);
router.get("/employee/:employeeID", findByEmployeeId);
router.get("/:employeeID", findByEmployeeId);

module.exports = router;
