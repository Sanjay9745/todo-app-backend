//create express boilerplate
require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT;
const morgan = require("morgan");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
//connect to db
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/todo-app")
  .then(() => {
    console.log("connected to db");
  });
//create model
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  todoList: [
    {
      date: Date,
      task: String,
      isCompleted: Boolean,
    },
  ],
});
const User = mongoose.model("User", userSchema);
//middleware
app.use(express.json());
app.use(morgan("dev"));
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const userAuth = (req, res, next) => {
  const token = req.header("x-access-token");
  if (!token) return res.status(401).send("access denied");
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).send("invalid token");
  }
};
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    //check if user exists
    const user = await User.findOne({ email: email });
    if (!user) return res.status(400).send("user does not exist");
    //check if password is correct
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send("invalid password");
    //create and assign a token
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    res.status(200).json({ message: "login successful", token: token });
  } catch (error) {}
});
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate, hash password, and save to the database
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // Check if the email already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Create a new user
    const newUser = new User({
      name: name,
      email: email,
      password: hashPassword,
    });

    // Save the new user to the database
    await newUser.save();

    // Create and send a JWT token
    const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET);
    res
      .status(200)
      .json({ message: "User created successfully", token: token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/api/protected", userAuth);
app.get("/api/user-details", userAuth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user._id });
    res.status(200).json({ message: "success", user: user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.get("/api/todo", userAuth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user._id });
    res.status(200).json({ message: "success", todoList: user.todoList });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.post("/api/add-todo", userAuth, async (req, res) => {
  try {
    const { task } = req.body;
    const user = await User.findOne({ _id: req.user._id });
    user.todoList.push({ date: Date.now(), task: task, isCompleted: false });
    await user.save();
    res.status(200).json({ message: "success", todoList: user.todoList });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/delete-todo/:id", userAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: req.user._id });
    user.todoList = user.todoList.filter((todo) => todo._id != id);
    await user.save();
    res.status(200).json({ message: "success", todoList: user.todoList });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.post("/api/update-todo", userAuth, async (req, res) => {
  try {
    const { task, isCompleted, id } = req.body;
    console.log(req.body);
    const user = await User.findOne({ _id: req.user._id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.todoList = user.todoList.map((todo) => {
      if (todo._id == id) {
        todo.task = task || todo.task;
        todo.isCompleted = !todo.isCompleted;
      }
      return todo;
    });

    await user.save();
    console.log(user.todoList);

    // Send a success response to the client
    res
      .status(200)
      .json({ message: "Todo updated successfully", todoList: user.todoList });
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
