const express = require("express");
const router = express.Router();
const {
  createHomeVisit,
  getAllHomeVisits,
  getHomeVisitsByEmployee,
  getHomeVisitMonthlySummary,
  deleteHomeVisit,
} = require("../controllers/homeVisitController");

router.post("/", createHomeVisit);
router.post("/create", createHomeVisit);
router.get("/monthly-summary", getHomeVisitMonthlySummary);
router.get("/monthlysummary", getHomeVisitMonthlySummary);
router.get("/", getAllHomeVisits);
router.get("/all", getAllHomeVisits);
router.get("/employee/:employeeId", getHomeVisitsByEmployee);
router.delete("/:id", deleteHomeVisit);

module.exports = router;

