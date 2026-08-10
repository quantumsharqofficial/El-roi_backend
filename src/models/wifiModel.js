const mongoose = require("mongoose");
const { getModel } = require("../config/db");

const WifiConfigSchema = new mongoose.Schema(
  {
    wifiUsername: {
      type: String,
      required: true,
      default: "Ram Physio",
    },
    wifiPassword: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const WifiConfig = getModel("WifiConfig", WifiConfigSchema);

module.exports = WifiConfig;
