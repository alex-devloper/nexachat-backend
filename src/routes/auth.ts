import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";

const router = Router();

/*
  USER MODEL REQUIRED FIELDS
  name
  email
  username
  password
*/

// ⭐ SIGNUP
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    // email check
    const emailExist = await User.findOne({ email });
    if (emailExist) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // username check
    const usernameExist = await User.findOne({ username });
    if (usernameExist) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      username,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Signup Successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        profilePic: user.profilePic || "", // ✅ ADDED
      },
    });
  } catch (error) {
    console.log("SIGNUP ERROR:", error);
    res.status(500).json({ message: "Signup Server Error" });
  }
});

// ⭐ LOGIN (Email OR Username + Password)
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const secret = process.env.JWT_SECRET || "defaultsecret";

    const token = jwt.sign({ id: user._id }, secret, { expiresIn: "7d" });

    res.json({
      message: "Login Success",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        profilePic: user.profilePic || "", // ✅ ADDED
      },
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);
    res.status(500).json({ message: "Login Server Error" });
  }
});

// ⭐ SEARCH USER (by username)
router.get("/search/:username", async (req: Request, res: Response) => {
  try {
    console.log("SEARCH REQUEST --->", req.params.username);

    const username = req.params.username.toLowerCase();

    const user = await User.findOne({
      username: { $regex: "^" + username + "$", $options: "i" },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        userId: user._id,
        name: user.name,
        username: user.username,
        profilePic: user.profilePic || "", // ✅ ADDED
      },
    });
  } catch (error) {
    console.log("SEARCH ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
