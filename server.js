require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { connectDB } = require("./src/config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Import Routes
const apiRoutes = require("./src/routes/api.routes");

// API Routes
app.use("/api", apiRoutes);

// Base route
app.get("/", (req, res) => {
  res.send("EL-ROI Physio Core API is running...");
});

// Start Server & DB connection
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

app.use("/images", express.static(path.join(__dirname, "Images")));

startServer();
