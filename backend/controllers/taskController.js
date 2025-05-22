const { response } = require("express");
const Task = require("../models/Task");
const { create } = require("../models/User");

const getTasks = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};

    // If status is provided in the query, apply it to the filter
    if (status) {
      filter.status = status;
    }

    let tasks;
    if (req.user.role === "admin") {
      tasks = await Task.find(filter).populate(
        "assignedTo",
        "name email role profilePicture"
      );
    } else {
      tasks = await Task.find({ ...filter, assignedTo: req.user._id }).populate(
        "assignedTo",
        "name email role profilePicture"
      );
    }
    tasks = await Promise.all(
      tasks.map(async (task) => {
        const completedCount = task.todoChecklist.filter(
          (item) => item.completed
        ).length;

        return { ...task._doc, completedTodoCount: completedCount };
      })
    );

    const allTasks = await Task.countDocuments(
      req.user.role === "admin" ? {} : { assignedTo: req.user._id }
    );
    const pendingTasks = await Task.countDocuments({
      ...filter,
      ...(req.user.role !== "admin" && { assignedTo: req.user._id }),
      status: "pending",
    });
    const inProgressTasks = await Task.countDocuments({
      ...filter,

      ...(req.user.role !== "admin" && { assignedTo: req.user._id }),
      status: "in-progress",
    });

    const completedTasks = await Task.countDocuments({
      ...filter,
      ...(req.user.role !== "admin" && { assignedTo: req.user._id }),
      status: "completed",
    });
    res.status(200).json({
      tasks,
      statusSummary: {
        all: allTasks,
        pendingTasks,

        inProgressTasks,
        completedTasks,
      },
    });

    // If the user is an admin, show all tasks; otherwise, filter by assigned user
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get a single task by ID
// This function retrieves a task by its ID from the database and returns it in the response.
// access private

const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(
      "assignedTo",
      "name email role profilePicture"
    );
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.status(200).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create a new task
// This function creates a new task in the database and returns the created task in the response.
// access private, admin only
const createTask = async (req, res) => {
  try {
    console.log("Received req.body:", req.body);
    const {
      title,
      description,
      priority,
      todoChecklist,
      assignedTo,
      dueDate,
      attachments,
    } = req.body;

    // Basic validation
    if (!title || !description || !priority || !Array.isArray(assignedTo)) {
      return res
        .status(400)
        .json({
          message: "Missing required fields or 'assignedTo' is not an array",
        });
    }

    const task = await Task.create({
      title,
      description,
      priority,
      todoChecklist: todoChecklist || [],
      assignedTo,
      dueDate,
      attachments: attachments || [],
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update an existing task
// This function updates an existing task in the database and returns the updated task in the response.
// access private, admin only

const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    task.title = req.body.title || task.title;
    task.description = req.body.description || task.description;
    task.priority = req.body.priority || task.priority;
    task.todoChecklist = req.body.todoChecklist || task.todoChecklist;
    task.assignedTo = req.body.assignedTo || task.assignedTo;
    task.dueDate = req.body.dueDate || task.dueDate;
    task.attachments = req.body.attachments || task.attachments;

    if (req.body.assignedTo) {
      if (!Array.isArray(req.body.assignedTo)) {
        return res
          .status(400)
          .json({ message: "'assignedTo' should be an array" });
      }
      task.assignedTo = req.body.assignedTo;
    }
    const updatedTask = await task.save();
    res
      .status(200)
      .json({ message: "Task updated successfully", task: updatedTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a task
// This function deletes a task from the database and returns a success message in the response.
// access private, admin only

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    await task.deleteOne();
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update task status
// This function updates the status of a task in the database and returns the updated task in the response.
// access private

const updateTaskStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
  
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
  
      const task = await Task.findById(id);
  
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
  
      // Safely normalize assignedTo
      const assignedToArray = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];
  
      const isAssigned = assignedToArray.some(
        (userId) => userId.toString() === req.user._id.toString()
      );
  
      if (!isAssigned && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "You are not authorized to update this task" });
      }
  
      task.status = status;
  
      if (status === "completed") {
        task.todoChecklist = task.todoChecklist.map((item) => ({
          ...item,
          completed: true,
        }));
        task.progress = 100;
      }
  
      await task.save();
      res
        .status(200)
        .json({ message: "Task status updated successfully", task });
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  

// Update task checklist
// This function updates the checklist of a task in the database and returns the updated task in the response.
// access private
const updateTaskChecklist = async (req, res) => {
    try {
      const { todoChecklist } = req.body;
  
      // Validate checklist input
      if (
        !Array.isArray(todoChecklist) ||
        !todoChecklist.every(
          item => typeof item.title === 'string' && typeof item.completed === 'boolean'
        )
      ) {
        return res.status(400).json({ message: "Invalid checklist format" });
      }
  
      const task = await Task.findById(req.params.id);
  
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
  
      // Ensure assignedTo is treated as an array
      const assignedToArray = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];
  
      const isAssigned = assignedToArray.some(
        id => id.toString() === req.user._id.toString()
      );
  
      if (!isAssigned && req.user.role !== "admin") {
        return res.status(403).json({ message: "You are not authorized to update this task" });
      }
  
      // Update checklist
      task.todoChecklist = todoChecklist;
  
      const completedCount = todoChecklist.filter(item => item.completed).length;
      const totalItems = todoChecklist.length;
      task.progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  
      task.status =
        task.progress === 100
          ? "completed"
          : task.progress > 0
          ? "in-progress"
          : "pending";
  
      await task.save();
  
      const updatedTask = await Task.findById(req.params.id).populate(
        "assignedTo",
        "name email role profilePicture"
      );
  
      res.status(200).json({
        message: "Task checklist updated successfully",
        task: updatedTask
      });
    } catch (error) {
      console.error("Error updating checklist:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  


// Get dashboard data
// This function retrieves dashboard data for the admin and returns it in the response.
// access private, admin only
const getDashboardData = async (req, res) => {
    try {
      // Basic counts
      const totalTasks = await Task.countDocuments({});
      const pendingTasks = await Task.countDocuments({ status: "pending" });
      const completedTasks = await Task.countDocuments({ status: "completed" });
      const overdueTasks = await Task.countDocuments({
        dueDate: { $lt: new Date() },
        status: { $ne: "completed" },
      });
  
      // Distribution by status
      const taskStatuses = ["pending", "in-progress", "completed"];
      const taskDistributionRaw = await Task.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);
  
      const taskDistribution = taskStatuses.reduce((acc, status) => {
        const formattedKey = status.replace(/\s+/g, "");
        acc[formattedKey] =
          taskDistributionRaw.find((item) => item._id === status)?.count || 0;
        return acc;
      }, {});
      taskDistribution["All"] = totalTasks;
  
      // Distribution by priority
      const taskPriorities = ["low", "medium", "high"];
      const taskPriorityLevelsRaw = await Task.aggregate([
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]);
  
      const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
        acc[priority] =
          taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
        return acc;
      }, {});
  
      // Recent tasks
      const recentTasks = await Task.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .select("title status priority dueDate createdAt");
  
      // Final response
      res.status(200).json({
        statistics: {
          totalTasks,
          pendingTasks,
          completedTasks,
          overdueTasks,
        },
        charts: {
          taskDistribution,
          taskPriorityLevels,
        },
        recentTasks,
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  

const getUserDashboardData = async (req, res) => {
  try {
    const userId = req.user._id; // Get the user ID from the request
    

    // Basic counts
    const totalTasks = await Task.countDocuments({ assignedTo: userId });
    const pendingTasks = await Task.countDocuments({
      assignedTo: userId,
      status: "pending",
    });
    const completedTasks = await Task.countDocuments({
      assignedTo: userId,
      status: "completed",
    });
    const overdueTasks = await Task.countDocuments({
      assignedTo: userId,
      dueDate: { $lt: new Date() },
      status: { $ne: "completed" },
    });

    const taskStatuses = ["pending", "in-progress", "completed"];
    const taskDistributionRaw = await Task.aggregate([
      {
        $match: { assignedTo: userId },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);
    const taskDistribution = taskStatuses.reduce((acc, status) => {
        const formattedKey = status.replace(/\s+/g, "");
        acc[formattedKey] =
            taskDistributionRaw.find((item) => item._id === status)?.count || 0;
        return acc;
        }, {});
    taskDistribution["All"] = totalTasks;
    

    const taskPriorities = ["low", "medium", "high"];
    const taskPriorityLevelsRaw = await Task.aggregate([
      {
        $match: { assignedTo: userId },
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);
    
    const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
      acc[priority] =
        taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
      return acc;
    }, {});

    // Recent tasks
    const recentTasks = await Task.find({ assignedTo: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title status priority dueDate createdAt");

    // Final response
    res.status(200).json({
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
        charts: {
            taskDistribution,
            taskPriorityLevels,
        },
      recentTasks,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskChecklist,
  getDashboardData,
  getUserDashboardData,
};
