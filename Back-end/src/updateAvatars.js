import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Message from './models/Message.js';

const run = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);

    const avatars = {
      'taimoor@example.com': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
      'alicia@example.com': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
      'marcus@example.com': 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&h=200&q=80',
      'maya@example.com': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&h=200&q=80',
      'jordan@example.com': 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&h=200&q=80',
      'sarah@example.com': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
      'david@example.com': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80',
    };

    for (const [email, avatarUrl] of Object.entries(avatars)) {
      await User.updateOne({ email }, { $set: { avatarUrl } });
    }
    console.log('Updated user avatars in MongoDB');

    const alicia = await User.findOne({ email: 'alicia@example.com' });
    if (alicia) {
      await Message.updateOne(
        { senderId: alicia._id, attachments: { $size: 0 } },
        { $set: { attachments: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80'] } }
      );
      console.log('Updated sample message attachment');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();

