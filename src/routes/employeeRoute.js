const express = require("express");
const router = express.Router();
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  loginController,
  trainFace,
  getAllFacioEmployees,
} = require("../controllers/employeeController");
const { uploadEmployeeFace } = require("../middleware/EmployeeFacemulter");
const multer = require("multer");

const { uploadProfileImages } = require("../middleware/profilemulter");

router.post("/face", uploadEmployeeFace);

// Train endpoint: accept multiple files under field name 'image' and forward to Flask
const uploadTrain = multer({ storage: multer.memoryStorage() }).array("image");
router.post("/face/train", uploadTrain, trainFace);

router.get("/", getAllEmployees);
router.get("/facio/get-all", getAllFacioEmployees);
router.get("/:id", getEmployeeById);
router.post("/", uploadProfileImages, createEmployee);
router.put("/:id", uploadProfileImages, updateEmployee);
router.delete("/:id", deleteEmployee);

router.post("/login", loginController);

module.exports = router;
