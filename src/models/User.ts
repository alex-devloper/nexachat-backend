import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    // ✅ PROFILE FIELDS
    about: {
      type: String,
      default: "",
    },

    profilePic: {
      type: String,
      default: "",
    },

    // ⭐ ONLINE STATUS
    isOnline: {
      type: Boolean,
      default: false,
    },

    // ⭐ LAST SEEN / LAST ACTIVE
    lastSeen: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
