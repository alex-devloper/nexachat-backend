import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  participantsHash: string;

  lastMessage?: mongoose.Types.ObjectId;

  // ✅ unread count per userId (receiver side)
  unreadFor: Record<string, number>;

  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],

    // ✅ prevents duplicate conversations
    participantsHash: { type: String, required: true, unique: true },

    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },

    // unreadFor[userId] = count
    unreadFor: { type: Object, default: {} },
  },
  { timestamps: true }
);

ConversationSchema.index({ participantsHash: 1 }, { unique: true });

export default mongoose.model<IConversation>(
  "Conversation",
  ConversationSchema
);
