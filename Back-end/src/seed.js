import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';

export const seedDatabase = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already contains users. Skipping initial seed.');
      return;
    }

    console.log('Seeding initial data into MongoDB...');

    // 1. Create Users
    const currentUser = await User.create({
      name: 'Taimoor Abbasi',
      email: 'taimoor@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    const alicia = await User.create({
      name: 'Alicia Brooks',
      email: 'alicia@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    const marcus = await User.create({
      name: 'Marcus Hill',
      email: 'marcus@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    const maya = await User.create({
      name: 'Maya Chen',
      email: 'maya@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    const jordan = await User.create({
      name: 'Jordan Smith',
      email: 'jordan@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    const sarah = await User.create({
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    const david = await User.create({
      name: 'David Kim',
      email: 'david@example.com',
      passwordHash: 'REPLACE_WITH_HASH',
      avatarUrl: '',
    });

    // Helper to create conversation and messages
    const createConvWithMessages = async (participants, type, messagesData) => {
      let directKey = null;
      if (type === 'direct' && participants.length === 2) {
        directKey = Conversation.generateDirectKey(participants[0]._id, participants[1]._id);
      }

      const conversation = await Conversation.create({
        type,
        participants: participants.map((p) => p._id),
        directKey,
      });

      let lastMessage = null;
      for (const msg of messagesData) {
        lastMessage = await Message.create({
          conversationId: conversation._id,
          senderId: msg.sender._id,
          text: msg.text,
          attachments: [],
          readBy: [msg.sender._id, ...participants.map((p) => p._id)],
        });
      }

      if (lastMessage) {
        conversation.lastMessageId = lastMessage._id;
        conversation.lastMessageAt = lastMessage.createdAt;
        await conversation.save();
      }

      return conversation;
    };

    // 2. Create Conversations and Messages
    await createConvWithMessages(
      [currentUser, alicia],
      'direct',
      [
        { sender: alicia, text: 'Hey! The new onboarding flow is ready for review.' },
        { sender: currentUser, text: 'Perfect. I will check the mobile states and share notes after lunch.' },
        { sender: alicia, text: 'The mockups look great. Can we preview them in the dashboard?' },
      ]
    );

    await createConvWithMessages(
      [currentUser, marcus],
      'direct',
      [
        { sender: marcus, text: 'I pushed the bug fix to the integration branch.' },
        { sender: currentUser, text: 'Nice. I will run the regression checks this afternoon.' },
      ]
    );

    await createConvWithMessages(
      [currentUser, maya],
      'direct',
      [
        { sender: maya, text: 'The launch campaign is scheduled for Friday morning.' },
        { sender: currentUser, text: 'Thanks, I will prepare the final copy by Thursday.' },
      ]
    );

    await createConvWithMessages(
      [currentUser, jordan, alicia, marcus],
      'group',
      [
        { sender: jordan, text: 'We can finalize the delivery plan after stand-up.' },
        { sender: currentUser, text: 'Agreed. I will bring the sprint summary notes.' },
      ]
    );

    await createConvWithMessages(
      [currentUser, sarah],
      'direct',
      [
        { sender: sarah, text: 'Hey Taimoor, I reviewed the production cluster performance. All systems are green!' },
        { sender: currentUser, text: 'Awesome! Thanks for checking, Sarah.' },
        { sender: sarah, text: 'Let me know if we should scale up the database replica set before Friday.' },
      ]
    );

    await createConvWithMessages(
      [currentUser, david],
      'direct',
      [
        { sender: david, text: 'Hi Taimoor, could you verify the OAuth 2.0 token expiration configuration?' },
        { sender: currentUser, text: 'Sure, looking into the auth tokens right now.' },
        { sender: david, text: 'Great, we need to ensure refresh tokens rotate every 7 days.' },
      ]
    );

    console.log('Database seeded successfully with initial users, conversations, and messages.');
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
};

