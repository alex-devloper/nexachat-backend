import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI as string;

    if (!uri) {
      console.log("❌ MONGO_URI Missing in .env");
      return;
    }

    await mongoose.connect(uri);
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.log("❌ MongoDB Connection Failed", error);
    process.exit(1);
  }
};

export default connectDB;
