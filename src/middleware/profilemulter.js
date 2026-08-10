import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { sendResponse } from "../config/response.js";
import { CODES } from "../config/response-code.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the upload directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadDir = path.join(__dirname, "../../Images/EmployeeProfile");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let customUploadDir = uploadDir;

    // Ensure the directory exists
    ensureDirExists(customUploadDir);
    cb(null, customUploadDir);
  },
  filename: (req, file, cb) => {
    const name = req.body.name ? req.body.name.replace(/\s+/g, "_") : "default";
    const uniqueSuffix = `${file.originalname}`;
    cb(null, uniqueSuffix);
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

// Updated to handle single file upload
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter,
}).single("profilePhoto");

export const uploadProfileImages = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return res
        .status(500)
        .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, err.message));
    }
   
    next(); 
  });
};

/*
=== MIGRATION EXPLANATION ===
What changed:
- Converted imports and exports to ES Modules format.
- Resolved `__dirname` using `import.meta.url`.

Why it changed:
- Required for ES Modules.

MongoDB-specific considerations:
- None.
*/
