import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import { seedDatabase } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'img-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    if (file.mimetype.startsWith('image/') || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed!'), false);
    }
  },
});

// POST upload single image (for chat attachments or profile pictures)
router.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  });
});

// GET user profile by ID
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:userId - update user profile (name, title, bio, phone, status, avatarUrl)
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, title, bio, phone, status, avatarUrl } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (status !== undefined) updateData.status = status;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/users/:userId/avatar - update avatarUrl via JSON body
router.patch('/users/:userId/avatar', async (req, res) => {
  try {
    const { userId } = req.params;
    const { avatarUrl } = req.body;
    const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/:userId/avatar - upload new avatar file directly
router.post('/users/:userId/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar image file provided' });
    }
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
      .populate('participants', 'name email avatarUrl title bio phone status')
      .populate({
        path: 'lastMessageId',
        select: 'text createdAt senderId attachments',
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
        .populate('participants', 'name email avatarUrl title bio phone status')
        .populate('lastMessageId');

      if (conversation) {
        return res.json(conversation);
      }

      conversation = await Conversation.create({
        type: 'direct',
        participants,
        directKey,
      });

      const populated = await conversation.populate('participants', 'name email avatarUrl title bio phone status');
      return res.status(201).json(populated);
    }

    const conversation = await Conversation.create({
      type: type || 'group',
      participants,
    });

    const populated = await conversation.populate('participants', 'name email avatarUrl title bio phone status');
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
      .populate('senderId', 'name email avatarUrl title bio status')
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
      attachments: Array.isArray(attachments) ? attachments : [],
      readBy: [senderId],
    });

    // 2. Update conversation's lastMessageId and lastMessageAt
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageId: message._id,
      lastMessageAt: message.createdAt,
    });

    const populated = await message.populate('senderId', 'name email avatarUrl title bio status');
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
