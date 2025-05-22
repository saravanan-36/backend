const Task = require('../models/Task');
const User = require('../models/User');
const excelJs = require('exceljs');

const exportTasksReport = async (req, res) => {
  try {
    const tasks = await Task.find().populate('assignedTo', 'name email');
    const workbook = new excelJs.Workbook();
    const worksheet = workbook.addWorksheet('Tasks Report');

    worksheet.columns = [
      { header: 'Task ID', key: '_id', width: 24 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Priority', key: 'priority', width: 20 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Assigned To', key: 'assignedTo', width: 40 },
      { header: 'Due Date', key: 'dueDate', width: 20 },
    ];

    tasks.forEach((task) => {
      const assignedTo = task.assignedTo
        ? task.assignedTo.map((user) => `${user.name} (${user.email})`).join(', ')
        : 'Unassigned';

      worksheet.addRow({
        _id: task._id.toString(),
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedTo,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=tasks_report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting tasks report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const exportUsersReport = async (req, res) => {
  try {
    const users = await User.find().select('name email _id').lean();
    const tasks = await Task.find().populate('assignedTo', 'name email _id');

    const userTaskMap = {};
    users.forEach((user) => {
      userTaskMap[user._id.toString()] = {
        name: user.name,
        email: user.email,
        taskCount: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
      };
    });

    tasks.forEach((task) => {
      if (task.assignedTo) {
        task.assignedTo.forEach((user) => {
          const userId = user._id.toString();
          if (userTaskMap[userId]) {
            userTaskMap[userId].taskCount++;
            switch (task.status) {
              case 'Pending':
                userTaskMap[userId].pendingTasks++;
                break;
              case 'In Progress':
                userTaskMap[userId].inProgressTasks++;
                break;
              case 'Completed':
                userTaskMap[userId].completedTasks++;
                break;
            }
          }
        });
      }
    });

    const workbook = new excelJs.Workbook();
    const worksheet = workbook.addWorksheet('Users Task Report');

    worksheet.columns = [
      { header: 'User Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Total Assigned Tasks', key: 'taskCount', width: 20 },
      { header: 'Pending Tasks', key: 'pendingTasks', width: 20 },
      { header: 'In Progress Tasks', key: 'inProgressTasks', width: 20 },
      { header: 'Completed Tasks', key: 'completedTasks', width: 20 },
    ];

    Object.values(userTaskMap).forEach((userStats) => {
      worksheet.addRow(userStats);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=users_report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting users report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  exportTasksReport,
  exportUsersReport,
};
