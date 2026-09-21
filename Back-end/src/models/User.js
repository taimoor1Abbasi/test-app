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
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

const User = mongoose.model('User', userSchema);

export default User;

