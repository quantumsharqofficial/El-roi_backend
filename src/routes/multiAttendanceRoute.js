const express = require("express");
const router = express.Router();
const { markAttendance, newAttendance, getMonthlyAttendanceSummary } = require("../controllers/attendanceController");
const {
  getAllByMonth,
  findDate,
  findByEmployeeId,
  getMonthByEmployeeId,
  getDateByEmployeeId,
} = require("../controllers/newAttendanceController");

// Monthly Summary Route
router.get("/monthly-summary", getMonthlyAttendanceSummary);

// Mark route (handles check-in/check-out automatically)
router.patch("/mark", newAttendance);
router.post("/mark", newAttendance);

router.post("/test", newAttendance);

// Query routes
router.get("/getallbymonth", getAllByMonth);
router.get("/getallbymonth/:month", getAllByMonth);
router.get("/finddate", findDate);
router.get("/finddate/:date", findDate);
router.get("/find-date/:date", findDate);
router.get("/monthbyemployeeid/:employeeID/:month", getMonthByEmployeeId);
router.get("/monthbyemployeeid/:employeeID", getMonthByEmployeeId);
router.post("/monthbyemployeeid", getMonthByEmployeeId);
router.get("/datebyemployeeid/:employeeID/:date", getDateByEmployeeId);
router.post("/datebyemployeeid", getDateByEmployeeId);
router.get("/findbyemployeeid/:employeeID", findByEmployeeId);
router.get("/findbyemployeeid", findByEmployeeId);
router.get("/:employeeID", findByEmployeeId);

module.exports = router;
