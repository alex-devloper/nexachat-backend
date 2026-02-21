import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import path from "path";

import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/upload";
import userRoutes from "./routes/user"; // ✅✅✅ ADDED

import Message from "./models/Message";
import Conversation from "./models/Conversation";
import User from "./models/User";

const { Types } = mongoose;

// ================= DB =================
mongoose
  .connect("mongodb://127.0.0.1:27017/nexachat")
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("Mongo Error ❌", err));

const app = express();
app.use(cors());
app.use(express.json());

// ✅ serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);

// ✅ Upload route
app.use("/api", uploadRoutes);

// ✅✅✅ USER ROUTES (profile update etc.)
app.use("/api/user", userRoutes); // ✅✅✅ ADDED

/**
 * =======================================================
 * ✅ CHAT LIST API (WhatsApp Style)  ✅ DUPLICATE FIXED ✅
 * =======================================================
 */
app.get("/api/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const uId = new Types.ObjectId(userId);

    const conversations: any[] = await Conversation.find({
      participants: { $in: [uId] },
    })
      .sort({ updatedAt: -1 })
      .populate("participants", "name username profilePic") // ✅ profilePic populated
      .populate("lastMessage")
      .lean();

    // ✅✅✅ DUPLICATE FIX: only 1 chat per user
    const chatsMap = new Map<string, any>();

    for (const conversation of conversations) {
      const otherUser = (conversation.participants as any[])
        .filter((p) => p && p._id)
        .find((p) => p._id.toString() !== userId);

      if (!otherUser) continue;

      const lastMessageData: any = conversation.lastMessage || null;

      const isSeen = lastMessageData?.seenAt ? true : false;
      const unreadCount = conversation.unreadFor?.[userId] || 0;

      const chatItem = {
        conversationId: conversation._id,
        userId: otherUser._id,
        name: otherUser.name || otherUser.username,
        username: otherUser.username,
        profilePic: otherUser.profilePic || "", // ✅✅✅ ADDED (IMPORTANT)
        lastMessage: lastMessageData?.message || "",
        lastMessageTime: lastMessageData?.createdAt || conversation.updatedAt,
        isSeen,
        unreadCount,
      };

      const key = otherUser._id.toString();
      const existing = chatsMap.get(key);

      // ✅ If multiple conversations exist, keep latest one only
      if (!existing) {
        chatsMap.set(key, chatItem);
      } else {
        const existingTime = new Date(existing.lastMessageTime).getTime();
        const newTime = new Date(chatItem.lastMessageTime).getTime();

        if (newTime > existingTime) {
          chatsMap.set(key, chatItem);
        }
      }
    }

    const chats = Array.from(chatsMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime()
    );

    return res.json({ chats });
  } catch (err) {
    console.error("Chat list error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * =======================================================
 * ✅ CHAT HISTORY API (conversationId based)
 * =======================================================
 */
app.get("/api/messages/conversation/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    return res.json({ messages });
  } catch (err) {
    console.error("Conversation messages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * =======================================================
 *  USER SEARCH API
 * =======================================================
 */
app.get("/api/auth/search/:query", async (req, res) => {
  try {
    const { query } = req.params;

    const user = await User.findOne({
      $or: [
        { username: new RegExp(query, "i") },
        { name: new RegExp(query, "i") },
      ],
    }).select("_id name username");

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      user: {
        userId: user._id,
        name: user.name,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * =======================================================
 * ✅ USER STATUS API (Online/Offline + Last Seen)
 * =======================================================
 */
app.get("/api/user/status/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "isOnline lastSeen name username"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * =======================================================
 * ✅✅✅ PUBLIC USER PROFILE API (VIEW ONLY)
 * =======================================================
 * Route: GET /api/user/:id
 * A user can view B user profile but cannot edit
 */
app.get("/api/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "_id name username about profilePic isOnline lastSeen"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        about: user.about || "",
        profilePic: user.profilePic || "",
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
    });
  } catch (err) {
    console.log("Public user profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ================= SOCKET.IO =================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

let onlineUsers: any[] = [];
const openChats = new Map<string, string>();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  /**
   * =======================================================
   * ✅ JOIN USER (ONLINE)
   * =======================================================
   */
  socket.on("joinUser", async (user) => {
    try {
      if (!user?.userId) return;

      // ✅ join room by userId
      socket.join(user.userId);

      // ✅ remove old same user
      onlineUsers = onlineUsers.filter((u) => u.userId !== user.userId);

      // ✅ add user
      onlineUsers.push({
        socketId: socket.id,
        userId: user.userId,
        name: user.name || "",
        username: user.username || "",
      });

      // ✅ DB update ONLINE
      await User.findByIdAndUpdate(user.userId, {
        isOnline: true,
      });

      // ✅ emit updated online users
      io.emit("onlineUsers", onlineUsers);
    } catch (err) {
      console.log("joinUser error:", err);
    }
  });

  socket.on("chatOpen", ({ viewerId, otherId }) => {
    if (!viewerId || !otherId) return;
    openChats.set(String(viewerId), String(otherId));
  });

  socket.on("chatClose", ({ viewerId }) => {
    if (!viewerId) return;
    openChats.delete(String(viewerId));
  });

  /**
   * ✅ TYPING INDICATOR (Instagram/WhatsApp style)
   */
  socket.on("typing", ({ fromUserId, toUserId }) => {
    if (!fromUserId || !toUserId) return;

    io.to(String(toUserId)).emit("typing", {
      fromUserId: String(fromUserId),
    });
  });

  socket.on("stopTyping", ({ fromUserId, toUserId }) => {
    if (!fromUserId || !toUserId) return;

    io.to(String(toUserId)).emit("stopTyping", {
      fromUserId: String(fromUserId),
    });
  });

  /**
   * =======================================================
   * ✅ DELETE MESSAGE (for me / for everyone)
   * =======================================================
   */
  socket.on(
    "deleteMessage",
    async ({ messageId, userId, otherUserId, deleteForEveryone }) => {
      try {
        if (!messageId || !userId) return;

        const msg = await Message.findById(messageId);
        if (!msg) return;

        // ✅ Delete for everyone
        if (deleteForEveryone) {
          await Message.findByIdAndUpdate(messageId, {
            isDeletedForEveryone: true,
            message: "🚫 This message was deleted",
          });

          // ✅ both users update
          io.to(String(userId)).emit("messageDeleted", {
            messageId,
            deleteForEveryone: true,
          });

          io.to(String(otherUserId)).emit("messageDeleted", {
            messageId,
            deleteForEveryone: true,
          });

          return;
        }

        // ✅ Delete for me only
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { deletedFor: String(userId) },
        });

        // ✅ only this user update
        io.to(String(userId)).emit("messageDeleted", {
          messageId,
          deleteForEveryone: false,
        });
      } catch (err) {
        console.log("deleteMessage error:", err);
      }
    }
  );

  /**
   * ✅ SEND MESSAGE + SAVE + UPDATE CONVERSATION
   * ✅ SENT SYSTEM ADDED ✅
   * ✅ REPLY SYSTEM ADDED ✅ (ONLY THIS ADDED)
   */
  socket.on(
    "privateMessage",
    async ({ senderId, receiverId, message, tempId, replyToId, replyText }) => {
      try {
        if (!senderId || !receiverId || !message) return;

        senderId = String(senderId);
        receiverId = String(receiverId);

        const receiverIsViewingSender = openChats.get(receiverId) === senderId;
        const receiverIsOnline = onlineUsers.some(
          (u) => u.userId === receiverId
        );

        const deliveredAt = receiverIsOnline ? new Date() : null;
        const seenAt = receiverIsViewingSender ? new Date() : null;

        // ✅ conversation find/create
        const hash = [senderId, receiverId].sort().join("_");

        const sId = new Types.ObjectId(senderId);
        const rId = new Types.ObjectId(receiverId);

        let conversation: any = await Conversation.findOne({
          participantsHash: hash,
        });

        // ✅✅✅ Race condition safe create
        if (!conversation) {
          try {
            conversation = await Conversation.create({
              participants: [sId, rId],
              participantsHash: hash,
              unreadFor: {},
            });
          } catch (err: any) {
            conversation = await Conversation.findOne({
              participantsHash: hash,
            });
          }
        }

        // ✅ create message with conversationId
        // ✅✅✅ Reply fields also saved
        const savedMessage: any = await Message.create({
          conversationId: conversation._id,
          sender: senderId,
          receiver: receiverId,
          message,
          deliveredAt,
          seenAt,

          // ✅ reply save
          replyToId: replyToId || null,
          replyText: replyText || null,
        });

        /**
         * ✅✅✅ SENT ACK (NEW)
         */
        io.to(senderId).emit("messageSent", {
          tempId: tempId || null,
          messageId: savedMessage._id,
          createdAt: savedMessage.createdAt,
        });

        // ✅ update conversation
        conversation.lastMessage = savedMessage._id;
        conversation.unreadFor = conversation.unreadFor || {};

        if (!receiverIsViewingSender) {
          conversation.unreadFor[receiverId] =
            (conversation.unreadFor[receiverId] || 0) + 1;
        } else {
          conversation.unreadFor[receiverId] = 0;
        }

        await conversation.save();

        // ✅ send to receiver
        // ✅✅✅ Reply fields also sent to frontend
        const receivers = onlineUsers.filter((u) => u.userId === receiverId);
        receivers.forEach((user) => {
          io.to(user.socketId).emit("receivePrivateMessage", {
            _id: savedMessage._id,
            conversationId: conversation._id,
            sender: senderId,
            receiver: receiverId,
            message: savedMessage.message,
            createdAt: savedMessage.createdAt,
            deliveredAt: savedMessage.deliveredAt,
            seenAt: savedMessage.seenAt,

            // ✅ reply send
            replyToId: savedMessage.replyToId || null,
            replyText: savedMessage.replyText || null,
          });
        });

        // ✅ deliver tick update sender
        const senders = onlineUsers.filter((u) => u.userId === senderId);
        senders.forEach((user) => {
          io.to(user.socketId).emit("messageDelivered", {
            receiverId,
            messageId: savedMessage._id,
          });
        });

        // ✅ realtime seen update to sender
        if (receiverIsViewingSender) {
          io.to(senderId).emit("messagesSeen", {
            senderId,
            receiverId,
            seenAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Message error:", err);
      }
    }
  );

  /**
   * ✅ MARK SEEN
   */
  socket.on("markSeen", async ({ senderId, receiverId }) => {
    try {
      if (!senderId || !receiverId) return;

      senderId = String(senderId);
      receiverId = String(receiverId);

      const receiverIsViewingSender = openChats.get(receiverId) === senderId;
      if (!receiverIsViewingSender) return;

      await Message.updateMany(
        { sender: senderId, receiver: receiverId, seenAt: null },
        { seenAt: new Date() }
      );

      // ✅ reset unread count
      const hash = [senderId, receiverId].sort().join("_");
      await Conversation.updateOne(
        { participantsHash: hash },
        { $set: { [`unreadFor.${receiverId}`]: 0 } }
      );

      // ✅ realtime seen update + seenAt
      io.to(senderId).emit("messagesSeen", {
        senderId,
        receiverId,
        seenAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Seen error:", err);
    }
  });

  /**
   * =======================================================
   * ✅ DISCONNECT (OFFLINE + LAST SEEN)
   * =======================================================
   */
  socket.on("disconnect", async () => {
    try {
      // ✅ find disconnected user
      const disconnectedUser = onlineUsers.find((u) => u.socketId === socket.id);

      // ✅ remove from onlineUsers
      onlineUsers = onlineUsers.filter((u) => u.socketId !== socket.id);

      // ✅ emit onlineUsers updated
      io.emit("onlineUsers", onlineUsers);

      // ✅ DB update OFFLINE + LAST SEEN
      if (disconnectedUser?.userId) {
        await User.findByIdAndUpdate(disconnectedUser.userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
      }

      // ✅ openChats cleanup
      for (const [viewerId] of openChats.entries()) {
        const stillOnline = onlineUsers.some((u) => u.userId === viewerId);
        if (!stillOnline) openChats.delete(viewerId);
      }
    } catch (err) {
      console.log("disconnect error:", err);
    }
  });
});

server.listen(5000, () => console.log("Server running on port 5000 🚀"));