import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    directKey: {
      type: String,
      sparse: true,
      index: true,
    },
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

// Helper to generate a deterministic composite key for direct 1-on-1 chats
conversationSchema.statics.generateDirectKey = function (userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `${ids[0]}:${ids[1]}`;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;

