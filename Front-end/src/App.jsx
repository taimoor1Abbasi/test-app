import { useState } from 'react'
import './App.css'

const conversations = [
  {
    id: 1,
    name: 'Alicia Brooks',
    title: 'Product Designer',
    status: 'online',
    accent: '#667eea',
    preview: 'The mockups look great. Can we preview them in the dashboard?',
  },
  {
    id: 2,
    name: 'Marcus Hill',
    title: 'Engineering Lead',
    status: 'away',
    accent: '#f59e0b',
    preview: 'I pushed the bug fix to the integration branch.',
  },
  {
    id: 3,
    name: 'Maya Chen',
    title: 'Marketing',
    status: 'online',
    accent: '#a78bfa',
    preview: 'The launch campaign is scheduled for Friday morning.',
  },
  {
    id: 4,
    name: 'Team Sync',
    title: 'Group chat',
    status: 'offline',
    accent: '#10b981',
    preview: 'Jordan: We can finalize the delivery plan after stand-up.',
  },
]

const initialMessages = {
  1: [
    { id: 1, sender: 'Alicia Brooks', mine: false, time: '9:14 AM', text: 'Hey! The new onboarding flow is ready for review.' },
    { id: 2, sender: 'You', mine: true, time: '9:16 AM', text: 'Perfect. I will check the mobile states and share notes after lunch.' },
    { id: 3, sender: 'Alicia Brooks', mine: false, time: '9:18 AM', text: 'The mockups look great. Can we preview them in the dashboard?' },
  ],
  2: [
    { id: 1, sender: 'Marcus Hill', mine: false, time: '8:45 AM', text: 'I pushed the bug fix to the integration branch.' },
    { id: 2, sender: 'You', mine: true, time: '8:47 AM', text: 'Nice. I will run the regression checks this afternoon.' },
  ],
  3: [
    { id: 1, sender: 'Maya Chen', mine: false, time: 'Yesterday', text: 'The launch campaign is scheduled for Friday morning.' },
    { id: 2, sender: 'You', mine: true, time: 'Yesterday', text: 'Thanks, I will prepare the final copy by Thursday.' },
  ],
  4: [
    { id: 1, sender: 'Jordan', mine: false, time: 'Mon', text: 'We can finalize the delivery plan after stand-up.' },
    { id: 2, sender: 'You', mine: true, time: 'Mon', text: 'Agreed. I will bring the sprint summary notes.' },
  ],
}

function App() {
  const [activeId, setActiveId] = useState(1)
  const [draft, setDraft] = useState('')
  const [messagesById, setMessagesById] = useState(initialMessages)

  const activeConversation = conversations.find((conversation) => conversation.id === activeId)
  const activeMessages = messagesById[activeId] ?? []

  const handleSend = (event) => {
    event.preventDefault()

    const trimmedMessage = draft.trim()
    if (!trimmedMessage) return

    const newMessage = {
      id: Date.now(),
      sender: 'You',
      mine: true,
      time: 'now',
      text: trimmedMessage,
    }

    setMessagesById((previous) => ({
      ...previous,
      [activeId]: [...(previous[activeId] ?? []), newMessage],
    }))
    setDraft('')
  }

  return (
    <main className="messenger-page">
      <div className="messenger-shell">
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">M</div>
            <div>
              <p className="brand-label">Messaging</p>
              <h2>Inbox</h2>
            </div>
          </div>

          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input type="text" placeholder="Search messages" />
          </div>

          <div className="nav-group">
            <p className="group-label">Recent</p>
            <div className="conversation-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-item ${activeId === conversation.id ? 'active' : ''}`}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <div className="avatar" style={{ background: conversation.accent }}>
                    {conversation.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                  </div>
                  <div className="conversation-copy">
                    <div className="meta-row">
                      <strong>{conversation.name}</strong>
                      <span>2m</span>
                    </div>
                    <small>{conversation.title}</small>
                    <p>{conversation.preview}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <div className="user-summary">
              <div className="avatar large" style={{ background: activeConversation.accent }}>
                {activeConversation.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h3>{activeConversation.name}</h3>
                <p>
                  {activeConversation.status === 'online'
                    ? 'Online now'
                    : activeConversation.status === 'away'
                      ? 'Away'
                      : 'Offline'}
                </p>
              </div>
            </div>

            <div className="header-actions">
              <button type="button">Call</button>
              <button type="button">Video</button>
            </div>
          </header>

          <div className="message-list">
            {activeMessages.map((message) => (
              <div key={message.id} className={`message-row ${message.mine ? 'mine' : ''}`}>
                <div className="message-bubble">
                  {!message.mine && <span className="sender-name">{message.sender}</span>}
                  <p>{message.text}</p>
                  <time>{message.time}</time>
                </div>
              </div>
            ))}
          </div>

          <form className="composer" onSubmit={handleSend}>
            <button type="button" className="tool-button">＋</button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              rows="1"
            />
            <button type="submit" className="send-button">Send</button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default App
