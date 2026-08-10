const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the upload directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadDir = path.join(__dirname, "../../../public/uploads/profiles");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + fileExtension);
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter,
}).single("profilePhoto");

const uploadEmployeeProfilePhoto = (req, res, next) => {
  const contentType = (req.headers["content-type"] || "").toLowerCase();

  // If the request is multipart/form-data, let multer handle it.
  if (contentType.includes("multipart/form-data")) {
    upload(req, res, (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      // Do not require a file — allow requests without an uploaded file
      // (frontend may send a base64/data URL in req.body.profilePhoto instead).
      return next();
    });
  } else {
    // Not a multipart request — continue without invoking multer
    return next();
  }
};

module.exports = {
  uploadEmployeeProfilePhoto,
};
