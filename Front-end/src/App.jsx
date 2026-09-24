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
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadError, setUploadError] = useState('')
  
  // Profile modal state
  const [profileUser, setProfileUser] = useState(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    title: '',
    bio: '',
    phone: '',
    status: 'online',
  })

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState(null)

  const imageInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const modalAvatarInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const getInitials = (name = '') => name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const renderAvatar = (user, className, fallbackColor) => (
    <div className={className} style={{ background: user?.avatarUrl ? '#e2e8f0' : fallbackColor }}>
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={`${user.name || 'User'} profile`}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        getInitials(user?.name)
      )}
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

  // Clean up attachment preview object URL
  useEffect(() => {
    if (selectedImage) {
      const url = URL.createObjectURL(selectedImage)
      setImagePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setImagePreviewUrl(null)
    }
  }, [selectedImage])

  // Format conversation metadata for display
  const getConversationMeta = (conv) => {
    const isDirect = conv.type === 'direct'
    const otherParticipant = conv.participants?.find((p) => p._id !== currentUser?._id) || conv.participants?.[0]

    const title = isDirect ? (otherParticipant?.name || 'Direct Chat') : 'Team Sync'
    const subtitle = isDirect ? (otherParticipant?.title || otherParticipant?.email || 'Direct message') : `${conv.participants?.length || 0} members`
    const accent = getAccentColor(conv._id)
    const initials = getInitials(title)

    const preview = conv.lastMessageId?.text || (conv.lastMessageId?.attachments?.length ? '📷 Photo' : 'No messages yet')
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

  // Open profile modal
  const handleOpenProfile = (user) => {
    if (!user) return
    setProfileUser(user)
    setEditForm({
      name: user.name || '',
      title: user.title || 'Team Member',
      bio: user.bio || '',
      phone: user.phone || '',
      status: user.status || 'online',
    })
    setIsEditingProfile(false)
  }

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profileUser) return
    setSavingProfile(true)
    try {
      const res = await fetch(`${API_BASE}/users/${profileUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated.error || 'Failed to update profile')

      setProfileUser(updated)
      setIsEditingProfile(false)

      // If it's the logged-in user, update current user and participants in conversation list
      if (currentUser && currentUser._id === updated._id) {
        setCurrentUser(updated)
      }
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          participants: conv.participants?.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)),
        }))
      )
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  // Upload helper
  const uploadImage = async (file) => {
    const formData = new FormData()
    formData.append('image', file)
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Image upload failed')
    return data.url
  }

  // Handle uploading avatar from sidebar or profile modal
  const handleAvatarFile = async (file, targetUserId) => {
    if (!file || !targetUserId) return
    setUploadingAvatar(true)
    setUploadError('')
    try {
      const avatarUrl = await uploadImage(file)
      const res = await fetch(`${API_BASE}/users/${targetUserId}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl }),
      })
      const updatedUser = await res.json()
      if (!res.ok) throw new Error(updatedUser.error || 'Profile picture update failed')

      if (currentUser && currentUser._id === targetUserId) {
        setCurrentUser(updatedUser)
      }
      if (profileUser && profileUser._id === targetUserId) {
        setProfileUser(updatedUser)
      }

      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          participants: conv.participants?.map((p) =>
            p._id === updatedUser._id ? { ...p, avatarUrl: updatedUser.avatarUrl } : p
          ),
        }))
      )
    } catch (err) {
      setUploadError(err.message)
      console.error(err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Handle selecting an image attachment for message
  const handleImageSelected = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadError('')
    setSelectedImage(file)
    event.target.value = ''
  }

  // Handle sending new message
  const handleSend = async (event) => {
    event.preventDefault()
    const trimmedMessage = draft.trim()
    if ((!trimmedMessage && !selectedImage) || !activeId || !currentUser) return

    setSending(true)
    setUploadError('')
    try {
      const attachments = selectedImage ? [await uploadImage(selectedImage)] : []
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
                  lastMessageId: {
                    text: savedMessage.text,
                    attachments: savedMessage.attachments,
                    createdAt: savedMessage.createdAt,
                  },
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
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">M</div>
            <div>
              <p className="brand-label">Messaging</p>
              <h2>Inbox</h2>
            </div>
          </div>

          {/* Current User Profile Card */}
          {currentUser && (
            <div
              className="current-user-card"
              onClick={() => handleOpenProfile(currentUser)}
              title="Click to view and edit your profile"
            >
              <div className="current-user-avatar-wrap">
                {renderAvatar(currentUser, 'current-user-avatar', '#4f46e5')}
              </div>
              <div className="current-user-info">
                <p className="current-user-name">
                  <span>{currentUser.name}</span>
                  <span className="current-user-badge">Profile</span>
                </p>
                <p className="current-user-email">{currentUser.title || currentUser.email}</p>
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

        {/* Chat Panel */}
        <section className="chat-panel">
          {activeMeta ? (
            <>
              <header className="chat-header">
                <div
                  className="user-summary"
                  onClick={() => activeMeta.otherParticipant && handleOpenProfile(activeMeta.otherParticipant)}
                  title="Click to view profile"
                >
                  {renderAvatar(activeMeta.otherParticipant, 'avatar large', activeMeta.accent)}
                  <div>
                    <h3>{activeMeta.title}</h3>
                    <p>
                      {activeConversation?.type === 'direct'
                        ? activeMeta.otherParticipant?.status
                          ? `● ${activeMeta.otherParticipant.status}`
                          : '● Online'
                        : `${activeConversation?.participants?.length} participants`}
                    </p>
                  </div>
                </div>

                <div className="header-actions">
                  <button
                    type="button"
                    onClick={() => activeMeta.otherParticipant && handleOpenProfile(activeMeta.otherParticipant)}
                  >
                    View Profile
                  </button>
                  <button type="button">Call</button>
                  <button type="button">Video</button>
                </div>
              </header>

              <div className="message-list">
                {messages.map((message) => {
                  const senderId = message.senderId?._id || message.senderId
                  const isMine = currentUser && senderId === currentUser._id
                  const senderName = isMine ? 'You' : message.senderId?.name || 'User'

                  return (
                    <div key={message._id} className={`message-row ${isMine ? 'mine' : ''}`}>
                      {!isMine && (
                        <div
                          style={{ cursor: 'pointer' }}
                          onClick={() => message.senderId && handleOpenProfile(message.senderId)}
                          title="View profile"
                        >
                          {renderAvatar(message.senderId, 'message-avatar', getAccentColor(senderId))}
                        </div>
                      )}
                      <div className="message-bubble">
                        {!isMine && (
                          <span
                            className="sender-name"
                            style={{ cursor: 'pointer' }}
                            onClick={() => message.senderId && handleOpenProfile(message.senderId)}
                          >
                            {senderName}
                          </span>
                        )}
                        {message.text && <p>{message.text}</p>}
                        {message.attachments?.map((attachment, idx) => (
                          <img
                            key={idx}
                            className="message-image"
                            src={attachment}
                            alt="Attachment"
                            onClick={() => setLightboxImage(attachment)}
                            title="Click to view full size"
                          />
                        ))}
                        <time>{formatMessageTime(message.createdAt)}</time>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer Attachment Preview Bar */}
              {selectedImage && imagePreviewUrl && (
                <div className="composer-attachment-bar">
                  <div className="attachment-preview-card">
                    <img className="attachment-preview-img" src={imagePreviewUrl} alt="Preview" />
                    <span className="attachment-preview-name">{selectedImage.name}</span>
                    <button
                      type="button"
                      className="attachment-remove-btn"
                      onClick={() => setSelectedImage(null)}
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Composer */}
              <form className="composer" onSubmit={handleSend}>
                <button
                  type="button"
                  className="tool-button"
                  onClick={() => imageInputRef.current?.click()}
                  title="Attach an image"
                >
                  ＋
                </button>
                <input
                  ref={imageInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelected}
                />
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
                <button
                  type="submit"
                  className="send-button"
                  disabled={sending || (!draft.trim() && !selectedImage)}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
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

      {/* Hidden File Input for Sidebar Avatar */}
      <input
        ref={avatarInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && currentUser) handleAvatarFile(file, currentUser._id)
          e.target.value = ''
        }}
      />

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img className="lightbox-image" src={lightboxImage} alt="Full resolution" />
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxImage(null)}
              title="Close image"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileUser && (
        <div className="profile-modal-overlay" onClick={() => setProfileUser(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            {/* Banner */}
            <div className="profile-banner">
              <button
                type="button"
                className="profile-close-btn"
                onClick={() => setProfileUser(null)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Profile Body */}
            <div className="profile-body">
              {/* Avatar section */}
              <div className="profile-avatar-wrap">
                <div className="profile-large-avatar">
                  {renderAvatar(profileUser, 'profile-large-avatar', '#4f46e5')}
                </div>
                {currentUser && currentUser._id === profileUser._id && (
                  <>
                    <button
                      type="button"
                      className="profile-camera-btn"
                      onClick={() => modalAvatarInputRef.current?.click()}
                      title="Upload new profile picture"
                    >
                      📷
                    </button>
                    <input
                      ref={modalAvatarInputRef}
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleAvatarFile(file, profileUser._id)
                        e.target.value = ''
                      }}
                    />
                  </>
                )}
              </div>

              {/* Header Info */}
              <div className="profile-header-info">
                <div className="profile-header-name-row">
                  <h3 className="profile-header-name">{profileUser.name}</h3>
                  <span className={`profile-status-pill ${profileUser.status || 'online'}`}>
                    <span className="profile-status-dot" />
                    {profileUser.status || 'Online'}
                  </span>
                </div>
                <p className="profile-headline">{profileUser.title || 'Team Member'}</p>
                {uploadingAvatar && <p style={{ fontSize: '0.8rem', color: '#6366f1', margin: '4px 0 0' }}>Uploading photo...</p>}
              </div>

              {/* View Mode vs Edit Mode */}
              {isEditingProfile ? (
                <form className="profile-edit-form" onSubmit={handleSaveProfile}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Title / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Lead Designer, Engineer"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="online">Online</option>
                      <option value="away">Away</option>
                      <option value="busy">Busy</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>About / Bio</label>
                    <textarea
                      placeholder="Tell the team about yourself..."
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="profile-button-row">
                    <button type="submit" className="btn-primary-action" disabled={savingProfile}>
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      onClick={() => setIsEditingProfile(false)}
                      disabled={savingProfile}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Bio Card */}
                  <div className="profile-section-card">
                    <p className="profile-section-title">About</p>
                    <p className="profile-bio-text">
                      {profileUser.bio || 'No bio provided yet.'}
                    </p>
                  </div>

                  {/* Contact Details Card */}
                  <div className="profile-section-card">
                    <p className="profile-section-title">Contact & Details</p>
                    <div className="profile-details-grid">
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Email</span>
                        <span className="profile-detail-value">{profileUser.email}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Phone</span>
                        <span className="profile-detail-value">{profileUser.phone || 'Not set'}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Status</span>
                        <span className="profile-detail-value" style={{ textTransform: 'capitalize' }}>
                          {profileUser.status || 'Online'}
                        </span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Member Since</span>
                        <span className="profile-detail-value">
                          {profileUser.createdAt ? new Date(profileUser.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="profile-button-row">
                    {currentUser && currentUser._id === profileUser._id ? (
                      <button
                        type="button"
                        className="btn-primary-action"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        Edit Profile
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary-action"
                        onClick={() => {
                          const directConv = conversations.find(
                            (c) =>
                              c.type === 'direct' &&
                              c.participants?.some((p) => p._id === profileUser._id)
                          )
                          if (directConv) {
                            setActiveId(directConv._id)
                          }
                          setProfileUser(null)
                        }}
                      >
                        Send Message
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
