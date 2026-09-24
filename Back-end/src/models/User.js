import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: 'REPLACE_WITH_HASH',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: 'Team Member',
    },
    bio: {
      type: String,
      default: 'Hey there! I am using this messaging app.',
    },
    phone: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['online', 'away', 'busy', 'offline'],
      default: 'online',
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

const User = mongoose.model('User', userSchema);

export default User;
