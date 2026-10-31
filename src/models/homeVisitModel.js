const mongoose = require("mongoose");
const { getModel } = require("../config/db");

const HomeVisitSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    day: {
      type: String,
      default: "",
    },
    startTime: {
      type: String,
      default: "",
    },
    endTime: {
      type: String,
      default: "",
    },
    duration: {
      type: String,
      default: "",
    },
    patientName: {
      type: String,
      required: true,
    },
    pain: {
      type: Number,
      default: 0,
    },
    diagnosis: {
      type: String,
      default: "",
    },
    prescription: {
      type: String,
      default: "",
    },
    modalities: {
      type: String,
      default: "",
    },
    comments: {
      type: String,
      default: "",
    },
    place: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    gpsAccuracy: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      default: "Completed",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = getModel("HomeVisit", HomeVisitSchema);

