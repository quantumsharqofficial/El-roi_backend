const ShortlistedCandidate = require("../models/shortlistedModel");

const getShortlistedCandidates = async (req, res) => {
  try {
    const candidates = await ShortlistedCandidate.find({ status: "Active" });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createShortlistedCandidate = async (req, res) => {
  try {
    const activeCount = await ShortlistedCandidate.countDocuments({ status: "Active" });
    if (activeCount >= 6) {
      return res.status(400).json({ message: "Maximum capacity of 6 active shortlisted candidates reached." });
    }
    const candidate = await ShortlistedCandidate.create(req.body);
    res.status(201).json(candidate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateShortlistedCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = await ShortlistedCandidate.findByIdAndUpdate(id, req.body, { new: true });
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    res.json(candidate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteShortlistedCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = await ShortlistedCandidate.findByIdAndDelete(id);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    res.json({ message: "Candidate removed successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getShortlistedCandidates,
  createShortlistedCandidate,
  updateShortlistedCandidate,
  deleteShortlistedCandidate,
};
