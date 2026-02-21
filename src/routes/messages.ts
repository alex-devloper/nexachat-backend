import { Router } from "express";
import Message from "../models/Message";

const router = Router();

// ===============================
// GET CHAT BETWEEN TWO USERS
// ===============================
router.post("/get", async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (error) {
    console.error("Message fetch error:", error);
    return res.status(500).json({ message: "Message fetch error" });
  }
});

// ===============================
// ✏️ EDIT MESSAGE
// ===============================
router.patch("/edit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { newText, userId } = req.body;

    if (!newText || !newText.trim()) {
      return res.status(400).json({ message: "Message text required" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // ✅ only sender can edit
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // ✅ 15 minute rule
    const FIFTEEN_MIN = 15 * 60 * 1000;
    const createdAt = new Date(message.createdAt).getTime();

    if (Date.now() - createdAt > FIFTEEN_MIN) {
      return res.status(403).json({ message: "Edit time expired" });
    }

    message.message = newText;
    message.edited = true;
    message.editedAt = new Date();

    await message.save();

    return res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Edit message error:", error);
    return res.status(500).json({ message: "Edit failed" });
  }
});

export default router;
