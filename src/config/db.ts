import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI as string;

    // 🔎 Debug: check if Railway is reading the env variable
    console.log("ENV MONGO_URI:", uri);

    if (!uri) {
      console.log("❌ MONGO_URI Missing in environment variables");
      return;
    }

    await mongoose.connect(uri);
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.log("❌ MongoDB Connection Failed:", error);
    process.exit(1);
  }
};

export default connectDB;