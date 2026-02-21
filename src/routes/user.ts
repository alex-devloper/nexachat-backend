import express from "express";
import User from "../models/User";

const router = express.Router();

// ✅ UPDATE PROFILE
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, about, profilePic } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { name, about, profilePic },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "Profile updated ✅",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        about: user.about,
        profilePic: user.profilePic,
      },
    });
  } catch (err) {
    console.log("Update profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ VIEW USER PROFILE (PUBLIC)
router.get("/profile/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name username about profilePic"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.log("Profile fetch error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
