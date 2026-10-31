const express = require('express');
const router = express.Router();
const employeeRoutes = require('./employeeRoute');
const multiAttendanceRoutes = require('./multiAttendanceRoute');
const attendanceRoutes = require('./attendanceRoute');
const newAttendanceRoutes = require('./newAttendanceRoute');
const wifiRoutes = require('./wifiRoute');
const leaveRoutes = require('./leaveRoute');
const shortlistedRoutes = require('./shortlistedRoute');
const payrollRoutes = require('./payrollRoute');
const alertRoutes = require('./alertRoute');
const homeVisitRoutes = require('./homeVisitRoute');
const { isMock } = require('../config/db');
const { shift } = require('../config/shift');

router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: isMock() ? 'Local JSON DB (Mock)' : 'MongoDB Connected'
  });
});

router.use('/employees', employeeRoutes);
router.use('/multi-attendance', multiAttendanceRoutes);
router.use('/new-attendance', newAttendanceRoutes);
router.use('/newattendance', newAttendanceRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/wifi', wifiRoutes);
router.use('/leaves', leaveRoutes);
router.use('/shortlisted', shortlistedRoutes);
router.use('/payroll', payrollRoutes);
router.use('/alerts', alertRoutes);
router.use('/home-visits', homeVisitRoutes);
router.use('/home-visit', homeVisitRoutes);
router.use('/homevisits', homeVisitRoutes);
router.get('/shifts', (req, res) => { res.json(shift) });


module.exports = router;
