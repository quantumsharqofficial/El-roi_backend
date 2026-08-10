const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the upload directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadDir = path.join(
  __dirname,
  "../../../../flask.faceextract.quantumfacio.com/data/data_faces_from_camera"
);

// We use a simple counter, but ideally this shouldn't be global in production.
let count = 1;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const parts = file.originalname.split("_");
    if (parts.length < 3) {
      return cb(new Error("Invalid filename format"), null);
    }

    // Format: empName_empID_front_0.jpg
    const empName = parts[0];
    const empID = parts[1];

    const empFolder = path.join(uploadDir, `${empName}_${empID}`);
    ensureDirExists(empFolder);
    cb(null, empFolder);
  },

  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const parts = file.originalname.split("_");
    const empName = parts[0];
    const empID = parts[1];

    const newFileName = `${empName}_${empID}_${count}${fileExtension}`;
    count++;
    cb(null, newFileName);
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png, gif) are allowed"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB limit
  fileFilter,
}).fields([
  { name: "frontView", maxCount: 10 },
  { name: "rightSide", maxCount: 10 },
  { name: "leftSide", maxCount: 10 },
]);

const uploadEmployeeFace = (req, res) => {
  count = 1; // Reset count per request (note: not safe for concurrent requests)
  upload(req, res, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
    res.status(201).json({
      success: true,
      message: "Image Uploaded Successfully",
      data: req.files
    });
  });
};

module.exports = {
  uploadEmployeeFace
};
