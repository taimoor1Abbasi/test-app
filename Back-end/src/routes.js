import express from 'express';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import { seedDatabase } from './seed.js';

const router = express.Router();

// GET all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET current logged-in demo user (default to Taimoor Abbasi or first user)
router.get('/currentUser', async (req, res) => {
  try {
    let user = await User.findOne({ email: 'taimoor@example.com' }).select('-passwordHash');
    if (!user) {
      user = await User.findOne().select('-passwordHash');
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET conversations for a user (or all conversations)
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { participants: userId } : {};

    const conversations = await Conversation.find(filter)
      .populate('participants', 'name email avatarUrl')
      .populate({
        path: 'lastMessageId',
        select: 'text createdAt senderId',
        populate: { path: 'senderId', select: 'name' },
      })
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST / create or get direct conversation
router.post('/conversations', async (req, res) => {
  try {
    const { participants, type = 'direct' } = req.body;

    if (!participants || participants.length < 2) {
      return res.status(400).json({ error: 'At least two participants are required' });
    }

    if (type === 'direct' && participants.length === 2) {
      const directKey = Conversation.generateDirectKey(participants[0], participants[1]);
      let conversation = await Conversation.findOne({ directKey })
        .populate('participants', 'name email avatarUrl')
        .populate('lastMessageId');

      if (conversation) {
        return res.json(conversation);
      }

      conversation = await Conversation.create({
        type: 'direct',
        participants,
        directKey,
      });

      const populated = await conversation.populate('participants', 'name email avatarUrl');
      return res.status(201).json(populated);
    }

    const conversation = await Conversation.create({
      type: type || 'group',
      participants,
    });

    const populated = await conversation.populate('participants', 'name email avatarUrl');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET messages for a conversation
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId })
      .populate('senderId', 'name email avatarUrl')
      .populate('readBy', 'name')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new message
router.post('/messages', async (req, res) => {
  try {
    const { conversationId, senderId, text, attachments = [] } = req.body;

    if (!conversationId || !senderId) {
      return res.status(400).json({ error: 'conversationId and senderId are required' });
    }

    // 1. Create message
    const message = await Message.create({
      conversationId,
      senderId,
      text: text || '',
      attachments,
      readBy: [senderId],
    });

    // 2. Update conversation's lastMessageId and lastMessageAt
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageId: message._id,
      lastMessageAt: message.createdAt,
    });

    const populated = await message.populate('senderId', 'name email avatarUrl');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST trigger database reset/seed
router.post('/seed', async (req, res) => {
  try {
    await seedDatabase();
    res.json({ message: 'Seed process finished' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

