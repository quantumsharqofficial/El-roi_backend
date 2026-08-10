const Employee = require("../models/employeeModel");
const { port } = require("../config/db");
const baseUrl = port.replace(/\/api\/?$/, "");
const axios = require("axios");

const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isDeleted: { $ne: true } });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId
      ? { _id: req.params.id }
      : { employeeId: req.params.id };
    const employee = await Employee.findOne(query);

    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employeeData = employee.toObject ? employee.toObject() : employee;
    res.json(employeeData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const parseJSONFields = (body) => {
  if (!body) return;
  const fields = [
    "certifications",
    "workExperience",
    "education",
    "bankDetails",
  ];
  fields.forEach((field) => {
    if (body[field] && typeof body[field] === "string") {
      try {
        body[field] = JSON.parse(body[field]);
      } catch (e) {
        console.error(`Error parsing ${field}:`, e);
      }
    }
  });
};

const createEmployee = async (req, res) => {
  try {
    const profilePhoto = req.file
      ? `${port}/images/EmployeeProfile/${req.file.filename}`
      : null;
    if (profilePhoto) {
      req.body.profilePhoto = profilePhoto;
    }
    parseJSONFields(req.body);
    const employee = await Employee.create(req.body);
    res.status(201).json(employee);
  } catch (error) {
    console.error("createEmployee error:", error);
    res.status(400).json({ error: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const profilePhoto = req.file
      ? `${port}/images/EmployeeProfile/${req.file.filename}`
      : null;
    if (profilePhoto) {
      req.body.profilePhoto = profilePhoto;
    }
    parseJSONFields(req.body);
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId
      ? { _id: req.params.id }
      : { employeeId: req.params.id };
    const employee = await Employee.findOneAndUpdate(query, req.body, {
      new: true,
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  } catch (error) {
    console.error("updateEmployee error:", error);
    res.status(400).json({ error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId
      ? { _id: req.params.id }
      : { employeeId: req.params.id };
    const employee = await Employee.findOneAndUpdate(
      query,
      { isDeleted: true },
      { new: true },
    );
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const employee = await Employee.findOne({
      $or: [{ email: email }, { employeeId: email }],
      isDeleted: { $ne: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (email && password && email !== password) {
      if (
        employee.workPhoneNumber !== password &&
        employee.personalPhoneNumber !== password
      ) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    }

    res.json({
      message: "Login successful",
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        dob: employee.dob,
        gender: employee.gender,
        profilePhoto: employee.profilePhoto,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  loginController,
  trainFace,
  getAllFacioEmployees,
};

const normalizeFaceVector = (data) => {
  const rawVector =
    data?.faceVector ??
    data?.face_vector ??
    data?.vector ??
    data?.embedding ??
    data?.encoding ??
    data?.vector_string;

  if (Array.isArray(rawVector)) {
    return rawVector
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }

  if (typeof rawVector !== "string") return [];

  const trimmed = rawVector.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    }
  } catch {
    // Fall back to comma-separated vectors returned by older Flask services.
  }

  return trimmed
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
};

const getEmployeeName = (employee) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() ||
  employee.employeeId ||
  String(employee._id);

async function trainFace(req, res) {
  console.log("Starting face vector extraction process for employee...");
  try {
    const flaskUrl =
      process.env.FLASK_FACE_EXTRACT_URL ||
      "https://flask.faceextract.quantumfacio.com/training";

    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required.",
      });
    }

    const isObjectId = String(id).match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: id } : { employeeId: id };
    const employee = await Employee.findOne(query);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found.",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images provided.",
      });
    }

    const formData = new FormData();

    req.files.forEach((file, index) => {
      const blob = new Blob([file.buffer], {
        type: file.mimetype || "application/octet-stream",
      });

      formData.append(
        "image",
        blob,
        file.originalname || `face-${index + 1}.jpg`
      );
    });

    const empName = getEmployeeName(employee);
    const empId = employee.employeeId || String(employee._id);

    formData.append("id", empId);
    formData.append("name", empName);

    console.log(
      `Sending ${req.files.length} images to Flask for employee ${empId} (${empName})`
    );

    const response = await axios.post(flaskUrl, formData, {
      timeout: Number(process.env.FLASK_FACE_EXTRACT_TIMEOUT_MS) || 30000,
    });

    console.log("Flask Response:", response.data);

    const faceVector = normalizeFaceVector(response.data);

    if (response.data?.success !== false && faceVector.length > 0) {
      employee.faceVector = faceVector;
      employee.faceVectorUpdatedAt = new Date();
      employee.faceCaptureStatus = "vector_ready";
      await employee.save();

      return res.json({
        success: true,
        message: "Face model trained successfully!",
        employee_id: employee.employeeId,
        faceVector,
        vector_string: faceVector.join(","),
        employee: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
          faceCaptureStatus: employee.faceCaptureStatus,
          faceVector,
          faceVectorUpdatedAt: employee.faceVectorUpdatedAt,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Failed to extract vector from Flask server.",
        details: response.data,
      });
    }
  } catch (error) {
    const flaskError =
      error.response?.data?.message || error.response?.data || error.message;
    console.error("Extraction error from Flask:", flaskError);
    return res.status(500).json({
      success: false,
      message: "Error from Flask server during extraction.",
      error: flaskError,
    });
  }
}

async function getAllFacioEmployees(req, res) {
  try {
    const employees = await Employee.find({ isDeleted: { $ne: true } });

    const formatted = employees.map((emp) => {
      let photoUrl = emp.profilePhoto || "";
      if (photoUrl) {
        try {
          if (photoUrl.startsWith("http")) {
            const urlObj = new URL(photoUrl);
            photoUrl = urlObj.pathname;
          } else if (!photoUrl.startsWith("/")) {
            photoUrl = "/" + photoUrl;
          }
        } catch (e) {
          console.error("Error parsing photo URL:", e);
        }
      }

      const vectorCode =
        Array.isArray(emp.faceVector) && emp.faceVector.length > 0
          ? emp.faceVector.join(",")
          : "";

      return {
        employee_ID: emp.employeeId || String(emp._id),
        name: [emp.firstName, emp.lastName].filter(Boolean).join(" ").trim(),
        vectorCode,
        photo: photoUrl,
        status: emp.status ? emp.status.toUpperCase() : "ACTIVE",
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("getAllFacioEmployees error:", error);
    res.status(500).json({ error: error.message });
  }
}
