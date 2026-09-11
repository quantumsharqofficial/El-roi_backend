const express = require("express");
const router = express.Router();
const {
  getShortlistedCandidates,
  createShortlistedCandidate,
  updateShortlistedCandidate,
  deleteShortlistedCandidate,
} = require("../controllers/shortlistedController");

router.get("/", getShortlistedCandidates);
router.post("/", createShortlistedCandidate);
router.put("/:id", updateShortlistedCandidate);
router.delete("/:id", deleteShortlistedCandidate);

module.exports = router;
