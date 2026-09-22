import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_BASE = 'http://localhost:3000/api'

const ACCENT_COLORS = ['#667eea', '#f59e0b', '#a78bfa', '#10b981', '#ec4899', '#3b82f6']

const getAccentColor = (idString = '') => {
  let hash = 0
  for (let i = 0; i < idString.length; i++) {
    hash = idString.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length]
}

const formatMessageTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return 'now'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const imageInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const getInitials = (name = '') => name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const renderAvatar = (user, className, fallbackColor) => (
    <div className={className} style={{ background: user?.avatarUrl ? '#e2e8f0' : fallbackColor }}>
      {user?.avatarUrl ? <img src={user.avatarUrl} alt={`${user.name || 'User'} profile`} /> : getInitials(user?.name)}
    </div>
  )

  // 1. Fetch current user and conversations on mount
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        const userRes = await fetch(`${API_BASE}/currentUser`)
        const userData = await userRes.json()
        setCurrentUser(userData)

        const convRes = await fetch(`${API_BASE}/conversations`)
        const convData = await convRes.json()
        setConversations(convData)

        if (convData.length > 0) {
          setActiveId(convData[0]._id)
        }
      } catch (err) {
        console.error('Error loading initial data:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // 2. Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeId) return

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_BASE}/conversations/${activeId}/messages`)
        const data = await res.json()
        setMessages(data)
      } catch (err) {
        console.error('Error fetching messages:', err)
      }
    }

    fetchMessages()
  }, [activeId])

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Helper to format conversation metadata for display
  const getConversationMeta = (conv) => {
    const isDirect = conv.type === 'direct'
    const otherParticipant = conv.participants?.find((p) => p._id !== currentUser?._id) || conv.participants?.[0]

    const title = isDirect ? (otherParticipant?.name || 'Direct Chat') : 'Team Sync'
    const subtitle = isDirect ? (otherParticipant?.email || 'Direct message') : `${conv.participants?.length || 0} members`
    const accent = getAccentColor(conv._id)
    const initials = getInitials(title)

    const preview = conv.lastMessageId?.text || 'No messages yet'
    const time = conv.lastMessageAt ? formatMessageTime(conv.lastMessageAt) : ''

    return { title, subtitle, accent, initials, preview, time, otherParticipant }
  }

  const activeConversation = conversations.find((c) => c._id === activeId)
  const activeMeta = activeConversation ? getConversationMeta(activeConversation) : null

  const filteredConversations = conversations.filter((conv) => {
    if (!search.trim()) return true
    const meta = getConversationMeta(conv)
    return (
      meta.title.toLowerCase().includes(search.toLowerCase()) ||
      meta.preview.toLowerCase().includes(search.toLowerCase())
    )
  })

  // 3. Handle sending new message
  const handleImageSelected = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadError('')
    setSelectedImage(file)
    event.target.value = ''
  }

  const uploadImage = async (file, fieldName) => {
    const formData = new FormData()
    formData.append(fieldName, file)
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Image upload failed')
    return data.url
  }

  const handleAvatarSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !currentUser) return
    setUploadingAvatar(true)
    setUploadError('')
    try {
      const avatarUrl = await uploadImage(file, 'image')
      const res = await fetch(`${API_BASE}/users/${currentUser._id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl }),
      })
      const updatedUser = await res.json()
      if (!res.ok) throw new Error(updatedUser.error || 'Profile picture update failed')
      setCurrentUser(updatedUser)
      setConversations((prev) => prev.map((conversation) => ({
        ...conversation,
        participants: conversation.participants?.map((participant) => participant._id === updatedUser._id
          ? { ...participant, avatarUrl: updatedUser.avatarUrl }
          : participant),
      })))
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const trimmedMessage = draft.trim()
    if ((!trimmedMessage && !selectedImage) || !activeId || !currentUser) return

    setSending(true)
    setUploadError('')
    try {
      const attachments = selectedImage ? [await uploadImage(selectedImage, 'image')] : []
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId,
          senderId: currentUser._id,
          text: trimmedMessage,
          attachments,
        }),
      })

      if (res.ok) {
        const savedMessage = await res.json()
        setMessages((prev) => [...prev, savedMessage])
        setDraft('')
        setSelectedImage(null)

        // Update preview in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c._id === activeId
              ? {
                  ...c,
                  lastMessageId: { text: savedMessage.text, createdAt: savedMessage.createdAt },
                  lastMessageAt: savedMessage.createdAt,
                }
              : c
          )
        )
      }
    } catch (err) {
      setUploadError(err.message)
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
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

          {currentUser && (
            <div className="current-user-card">
              <button type="button" className="avatar-button" onClick={() => avatarInputRef.current?.click()} title="Change profile picture">
                {renderAvatar(currentUser, 'current-user-avatar', '#4f46e5')}
              </button>
              <input ref={avatarInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleAvatarSelected} />
              <div className="current-user-info">
                <p className="current-user-name">
                  <span>{currentUser.name}</span>
                  <span className="current-user-badge">You</span>
                </p>
                <p className="current-user-email">{currentUser.email}</p>
              </div>
            </div>
          )}

          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search messages"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="nav-group">
            <p className="group-label">Recent</p>
            <div className="conversation-list">
              {loading && conversations.length === 0 ? (
                <p style={{ padding: '10px', color: '#64748b' }}>Loading conversations...</p>
              ) : filteredConversations.length === 0 ? (
                <p style={{ padding: '10px', color: '#64748b' }}>No conversations found</p>
              ) : (
                filteredConversations.map((conversation) => {
                  const meta = getConversationMeta(conversation)
                  const isActive = activeId === conversation._id

                  return (
                    <button
                      key={conversation._id}
                      type="button"
                      className={`conversation-item ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveId(conversation._id)}
                    >
                      {renderAvatar(meta.otherParticipant, 'avatar', meta.accent)}
                      <div className="conversation-copy">
                        <div className="meta-row">
                          <strong>{meta.title}</strong>
                          <span>{meta.time || 'now'}</span>
                        </div>
                        <small>{meta.subtitle}</small>
                        <p>{meta.preview}</p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </aside>

        <section className="chat-panel">
          {activeMeta ? (
            <>
              <header className="chat-header">
                <div className="user-summary">
                  {renderAvatar(activeMeta.otherParticipant, 'avatar large', activeMeta.accent)}
                  <div>
                    <h3>{activeMeta.title}</h3>
                    <p>
                      {activeConversation?.type === 'direct' ? 'Online' : `${activeConversation?.participants?.length} participants`}
                    </p>
                  </div>
                </div>

                <div className="header-actions">
                  <button type="button">Call</button>
                  <button type="button">Video</button>
                </div>
              </header>

              <div className="message-list">
                {messages.map((message) => {
                  const senderId = message.senderId?._id || message.senderId
                  const isMine = currentUser && senderId === currentUser._id
                  const senderName = isMine ? 'You' : (message.senderId?.name || 'User')

                  return (
                    <div key={message._id} className={`message-row ${isMine ? 'mine' : ''}`}>
                      {!isMine && renderAvatar(message.senderId, 'message-avatar', getAccentColor(senderId))}
                      <div className="message-bubble">
                        {!isMine && <span className="sender-name">{senderName}</span>}
                        <p>{message.text}</p>
                        {message.attachments?.map((attachment) => (
                          <img key={attachment} className="message-image" src={attachment} alt="Shared attachment" />
                        ))}
                        <time>{formatMessageTime(message.createdAt)}</time>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <form className="composer" onSubmit={handleSend}>
                <button type="button" className="tool-button" onClick={() => imageInputRef.current?.click()} title="Attach an image">＋</button>
                <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleImageSelected} />
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e)
                    }
                  }}
                  placeholder="Write a message..."
                  rows="1"
                  disabled={sending}
                />
                <button type="submit" className="send-button" disabled={sending || (!draft.trim() && !selectedImage)}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
                {selectedImage && <span className="attachment-name">{selectedImage.name}</span>}
                {uploadingAvatar && <span className="upload-status">Updating photo...</span>}
                {uploadError && <span className="upload-error">{uploadError}</span>}
              </form>
            </>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#64748b' }}>
              Select a conversation to start messaging
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
