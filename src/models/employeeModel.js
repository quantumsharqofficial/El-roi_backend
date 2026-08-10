const mongoose = require("mongoose");
const { getModel } = require("../config/db");

/* ============================
   Work Experience Schema
============================ */
const WorkExperienceSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    fromDate: {
      type: Date,
    },
    toDate: {
      type: Date,
    },
  },
  { _id: false }
);

/* ============================
   Education Schema
============================ */
const EducationSchema = new mongoose.Schema(
  {
    instituteName: {
      type: String,
      trim: true,
    },
    degree: {
      type: String,
      trim: true,
    },
    yearOfPassing: {
      type: Number,
    },
  },
  { _id: false }
);

/* ============================
   Bank Details Schema
============================ */
const BankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: String,
    bankName: String,
    branchName: String,
    accountNumber: String,
    ifscCode: String,
    upiId: String,
  },
  { _id: false }
);

/* ============================
   Leave Balance Schema
============================ */
const LeaveBalanceSchema = new mongoose.Schema(
  {
    leaveType: {
      type: String,
      enum: ["Paid Annual Leave", "Sick Leave", "Casual Leave", "Unpaid Sick Leave"],
      required: true,
    },
    allowedDays: {
      type: Number,
      required: true,
      default: 0,
    },
    takenLeaves: {
      type: Number,
      required: true,
      default: 0,
    },

  },
  { _id: false }
);

/* ============================
   Employee Schema
============================ */
const EmployeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },

    /* ============================
       Basic Information
    ============================ */

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
    },

    dob: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Divorced", "Widowed"],
    },

    bloodGroup: {
      type: String,
    },

    profilePhoto: {
      type: String,
    },

    certifications: [
      {
        name: String,
        fileName: String,
        fileContent: String,
      },
    ],

    /* ============================
       Work Information
    ============================ */

    designation: {
      type: String,
      required: true,
    },

    sourceOfHire: {
      type: String,
    },

    dateOfJoining: {
      type: Date,
      required: true,
    },

    totalWorkExperience: {
      type: Number, // in years
      default: 0,
    },

    salary: {
      type: Number,
      default: 0,
    },
    employeeType: {
      type: String,
      enum: [
        "Onboarding",
        "Offboarding",
        "Probation Period",
        "Notice Period",
        "Permanent"
      ],
      required: true,
      default: "Onboarding"
    },

    probationEndDate: {
      type: Date,
    },

    noticePeriodEndDate: {
      type: Date,
    },

    /* ============================
       Contact Details
    ============================ */

    workPhoneNumber: {
      type: String,
    },

    personalPhoneNumber: {
      type: String,
    },

    emergencyContact: {
      type: String,
    },

    emergencyNumber: {
      type: String,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true
    },

    presentAddress: {
      type: String,
    },

    permanentAddress: {
      type: String,
    },

    /* ============================
       Experience
    ============================ */

    workExperience: [WorkExperienceSchema],

    /* ============================
       Education
    ============================ */

    education: [EducationSchema],

    /* ============================
       Bank Details
    ============================ */

    bankDetails: BankDetailsSchema,

    /* ============================
       Status
    ============================ */

    status: {
      type: String,
      enum: ["Active", "Inactive", "Resigned"],
      default: "Active",
    },
    faceVector: {
      type: [Number],
      default: [],
    },
    faceVectorUpdatedAt: {
      type: Date,
    },
    faceCaptureStatus: {
      type: String,
      enum: ["not_started", "captured", "vector_ready"],
      default: "not_started",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    checkInTime: {
      type: String,
      default: "09:00",
    },
    checkOutTime: {
      type: String,
      default: "17:00",
    },
    leaveBalances: {
      type: [LeaveBalanceSchema],
      default: [
        { leaveType: "Paid Annual Leave", allowedDays: 0, takenLeaves: 0 },
        { leaveType: "Sick Leave", allowedDays: 0, takenLeaves: 0 },
        { leaveType: "Casual Leave", allowedDays: 0, takenLeaves: 0 }
      ]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ============================
   Virtual Age
============================ */

EmployeeSchema.virtual("age").get(function () {
  if (!this.dob) return null;

  const diff = Date.now() - this.dob.getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

/* ============================
   Virtual Current Experience
============================ */

EmployeeSchema.virtual("currentExperience").get(function () {
  if (!this.dateOfJoining) return null;

  const diff = Date.now() - this.dateOfJoining.getTime();

  return +(diff / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
});

module.exports = getModel("Employee", EmployeeSchema);