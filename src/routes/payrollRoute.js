const express = require("express");
const router = express.Router();
const {
  calculatePayrollDetails,
  savePayroll,
  getPayrollByEmployee,
  getPayrollByMonth,
} = require("../controllers/payrollController");

router.get("/calculate", calculatePayrollDetails);
router.post("/", savePayroll);
router.get("/employee/:employeeId", getPayrollByEmployee);
router.get("/month/:month", getPayrollByMonth);

module.exports = router;
