const express = require('express');
const router = express.Router();
const employeeRoutes = require('./employeeRoute');
const multiAttendanceRoutes = require('./multiAttendanceRoute');
const attendanceRoutes = require('./attendanceRoute');
const wifiRoutes = require('./wifiRoute');
const leaveRoutes = require('./leaveRoute');
const { isMock } = require('../config/db');

router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: isMock() ? 'Local JSON DB (Mock)' : 'MongoDB Connected'
  });
});

router.use('/employees', employeeRoutes);
router.use('/multi-attendance', multiAttendanceRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/wifi', wifiRoutes);
router.use('/leaves', leaveRoutes);

module.exports = router;
