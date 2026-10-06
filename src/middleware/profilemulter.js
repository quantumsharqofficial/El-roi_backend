const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the upload directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadDir = path.join(__dirname, "../../Images/EmployeeProfile");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter,
}).single("profilePhoto");

const uploadProfileImages = (req, res, next) => {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    upload(req, res, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      next();
    });
  } else {
    next();
  }
};

module.exports = { uploadProfileImages };
