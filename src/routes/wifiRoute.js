const express = require("express");
const router = express.Router();
const { getWifiConfig, saveWifiConfig } = require("../controllers/wifiController");

router.get("/", getWifiConfig);
router.post("/", saveWifiConfig);

module.exports = router;
