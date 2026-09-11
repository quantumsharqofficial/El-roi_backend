const express = require("express");
const router = express.Router();
const { getSystemAlerts } = require("../controllers/alertController");

router.get("/", getSystemAlerts);

module.exports = router;
