const express = require("express");
const router = express.Router();
const {
  applyLeave,
  getAllLeaves,
  getLeavesByEmployee,
  updateLeaveStatus,
  deleteLeave,
} = require("../controllers/leaveController");

router.post("/", applyLeave);
router.get("/", getAllLeaves);
router.get("/employee/:employeeId", getLeavesByEmployee);
router.put("/:id", updateLeaveStatus);
router.delete("/:id", deleteLeave);

module.exports = router;
