const WifiConfig = require("../models/wifiModel");

const getWifiConfig = async (req, res) => {
  try {
    let config = await WifiConfig.findOne();
    if (!config) {
      config = {
        wifiUsername: "Ram Physio",
        wifiPassword: "",
      };
    }
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const saveWifiConfig = async (req, res) => {
  try {
    const { wifiUsername, wifiPassword } = req.body;
    if (!wifiUsername) {
      return res.status(400).json({ success: false, error: "WiFi Username is required" });
    }

    let config = await WifiConfig.findOne();
    if (config) {
      const id = config._id || config.id;
      const updated = await WifiConfig.findByIdAndUpdate(id, {
        wifiUsername,
        wifiPassword: wifiPassword || "",
      });
      config = updated || { _id: id, wifiUsername, wifiPassword };
    } else {
      config = await WifiConfig.create({
        wifiUsername,
        wifiPassword: wifiPassword || "",
      });
    }

    return res.status(200).json({
      success: true,
      message: "WiFi Configuration saved successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getWifiConfig,
  saveWifiConfig,
};
