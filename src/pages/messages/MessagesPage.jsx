import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { deleteConversation, getConversationMessages, getInboxMessages, getUserConversations, isSupabaseConfigured, markConversationMessagesRead, sendConversationMessage, supabase } from '../../utils/supabase'

const CHAT_EMOJIS = ['👍', '👋', '😊', '🙏', '❤️', '✅', '🎉', '💡', '📍', '📷', '🔧', '🏠']
const MOBILE_QUERY = '(max-width: 700px)'

function getCounterpartName(conversation, userId) {
  return String(conversation.client_id) === String(userId)
    ? conversation.provider_name || 'Profesional'
    : conversation.client_name || 'Cliente'
}

function getInitials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatDayLabel(timestamp) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return 'Hoy'
  if (dayKey(date) === dayKey(yesterday)) return 'Ayer'
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

// Hora si es de hoy, "Ayer", o fecha corta; se usa en la bandeja.
function formatInboxTime(timestamp) {
  const label = formatDayLabel(timestamp)
  if (label === 'Hoy') return formatMessageTime(timestamp)
  if (label === 'Ayer') return label
  return new Date(timestamp).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function upsertMessage(list, message) {
  if (list.some((item) => item.id === message.id)) return list.map((item) => (item.id === message.id ? { ...item, ...message } : item))
  return [...list, message].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export default function MessagesPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedConversationId = searchParams.get('conversation')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [inbox, setInbox] = useState([])
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const feedRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const textareaRef = useRef(null)
  const activeIdRef = useRef(null)
  const conversationIdsRef = useRef(new Set())
  const userId = session?.user?.id

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    const [conversationResult, inboxResult] = await Promise.all([getUserConversations(), getInboxMessages()])
    if (!conversationResult.error) setConversations(conversationResult.data || [])
    if (!inboxResult.error) setInbox(inboxResult.data || [])
    return conversationResult
  }, [])

  useEffect(() => {
    if (!userId) {
      setConversations([])
      setInbox([])
      return
    }

    let active = true
    setConversationsLoading(true)
    refreshConversations().then(({ error }) => {
      if (!active) return
      if (error) setNotice('No se pudieron cargar las conversaciones. Verifica el esquema de mensajería en Supabase.')
      setConversationsLoading(false)
    }).catch(() => {
      if (!active) return
      setNotice('No se pudieron cargar las conversaciones.')
      setConversationsLoading(false)
    })

    return () => { active = false }
  }, [userId, refreshConversations])

  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((conversation) => conversation.id))
  }, [conversations])

  useEffect(() => {
    activeIdRef.current = selectedConversationId
  }, [selectedConversationId])

  const markActiveRead = useCallback(async () => {
    const conversationId = activeIdRef.current
    if (!conversationId || !userId || document.visibilityState === 'hidden') return
    const { error } = await markConversationMessagesRead(conversationId, userId)
    if (error) return
    const readAt = new Date().toISOString()
    const patch = (message) => (message.conversation_id === conversationId && message.sender_id !== userId && !message.read_at ? { ...message, read_at: readAt } : message)
    setInbox((current) => current.map(patch))
    setMessages((current) => current.map(patch))
  }, [userId])

  // Un único canal en tiempo real: mensajes nuevos/leídos y conversaciones nuevas.
  useEffect(() => {
    if (!userId || !supabase) return

    function handleMessageChange(payload) {
      const message = payload.new
      if (!message?.id) return

      if (!conversationIdsRef.current.has(message.conversation_id)) {
        refreshConversations()
        return
      }

      setInbox((current) => {
        const exists = current.some((item) => item.id === message.id)
        return exists ? current.map((item) => (item.id === message.id ? { ...item, ...message } : item)) : [message, ...current]
      })

      if (message.conversation_id === activeIdRef.current) {
        setMessages((current) => upsertMessage(current, message))
        if (payload.eventType === 'INSERT' && message.sender_id !== userId) markActiveRead()
      }
    }

    const channel = supabase
      .channel(`chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleMessageChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, handleMessageChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `client_id=eq.${userId}` }, refreshConversations)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `provider_id=eq.${userId}` }, refreshConversations)
      .subscribe()

    function handleVisibility() {
      if (document.visibilityState === 'visible') markActiveRead()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userId, refreshConversations, markActiveRead])

  const { lastByConversation, unreadByConversation } = useMemo(() => {
    const last = {}
    const unread = {}
    // inbox llega ordenado de más reciente a más antiguo, pero los eventos en vivo se anteponen: se compara por fecha.
    for (const message of inbox) {
      const current = last[message.conversation_id]
      if (!current || new Date(message.created_at) > new Date(current.created_at)) last[message.conversation_id] = message
      if (message.sender_id !== userId && !message.read_at) unread[message.conversation_id] = (unread[message.conversation_id] || 0) + 1
    }
    return { lastByConversation: last, unreadByConversation: unread }
  }, [inbox, userId])

  const sortedConversations = useMemo(() => {
    const activity = (conversation) => new Date(lastByConversation[conversation.id]?.created_at || conversation.created_at)
    return [...conversations].sort((a, b) => activity(b) - activity(a))
  }, [conversations, lastByConversation])

  const visibleConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sortedConversations
    return sortedConversations.filter((conversation) => `${getCounterpartName(conversation, userId)} ${conversation.service_title}`.toLowerCase().includes(term))
  }, [sortedConversations, search, userId])

  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId)

  // En escritorio se abre la conversación más reciente; en móvil se muestra primero la bandeja.
  useEffect(() => {
    if (!sortedConversations.length || conversationsLoading) return
    if (selectedConversationId && !conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSearchParams({}, { replace: true })
    } else if (!selectedConversationId && !window.matchMedia(MOBILE_QUERY).matches) {
      setSearchParams({ conversation: sortedConversations[0].id }, { replace: true })
    }
  }, [sortedConversations, conversations, conversationsLoading, selectedConversationId, setSearchParams])

  useEffect(() => {
    if (!activeConversation?.id || !supabase) {
      setMessages([])
      return
    }

    let active = true
    stickToBottomRef.current = true
    setMessages([])
    setMessagesLoading(true)
    setNotice('')
    getConversationMessages(activeConversation.id).then(({ data, error }) => {
      if (!active) return
      if (error) setNotice(`No se pudieron cargar los mensajes: ${error.message}`)
      else {
        setMessages(data || [])
        markActiveRead()
      }
      setMessagesLoading(false)
    }).catch(() => {
      if (!active) return
      setNotice('No se pudieron cargar los mensajes de esta conversación.')
      setMessagesLoading(false)
    })

    return () => { active = false }
  }, [activeConversation?.id, markActiveRead])

  useEffect(() => {
    const feed = feedRef.current
    if (feed && stickToBottomRef.current) feed.scrollTop = feed.scrollHeight
  }, [messages])

  function handleFeedScroll(event) {
    const feed = event.currentTarget
    stickToBottomRef.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80
  }

  async function handleSend(event) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || !activeConversation || !userId || sending) return

    setSending(true)
    setNotice('')
    const { data, error } = await sendConversationMessage(activeConversation.id, userId, content)
    if (error || !data) {
      setNotice(error?.message || 'No se pudo enviar el mensaje. Inténtalo de nuevo.')
      setSending(false)
      return
    }

    stickToBottomRef.current = true
    setDraft('')
    setMessages((current) => upsertMessage(current, data))
    setInbox((current) => (current.some((item) => item.id === data.id) ? current : [data, ...current]))
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      handleSend()
    }
  }

  function addEmoji(emoji) {
    setDraft((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${emoji}`)
    setEmojiPickerOpen(false)
    textareaRef.current?.focus()
  }

  async function handleDeleteConversation() {
    if (!activeConversation || deleting) return
    const confirmed = window.confirm(`¿Eliminar la conversación sobre "${activeConversation.service_title}"? Se borrarán los mensajes para ti; la otra persona conservará el chat. Si te escribe de nuevo, la conversación reaparecerá solo con los mensajes nuevos.`)
    if (!confirmed) return

    setDeleting(true)
    setNotice('')
    const { data: hidden, error } = await deleteConversation(activeConversation.id)
    if (error || hidden !== true) {
      setNotice(`No se pudo eliminar la conversación: ${error?.message || 'No tienes permiso para eliminarla.'}`)
      setDeleting(false)
      return
    }

    setConversations((current) => current.filter((conversation) => conversation.id !== activeConversation.id))
    setMessages([])
    setSearchParams({}, { replace: true })
    setInbox((current) => current.filter((message) => message.conversation_id !== activeConversation.id))
    setNotice('Conversación eliminada para ti.')
    setDeleting(false)
  }

  const counterpartName = activeConversation && userId ? getCounterpartName(activeConversation, userId) : ''
  const totalUnread = Object.values(unreadByConversation).reduce((sum, count) => sum + count, 0)

  return <main className="messages-page">
    <header className="messages-heading">
      <div><p className="eyebrow">MENSAJERÍA</p><h1>Mensajes</h1></div>
      <p>Conversaciones vinculadas a tus publicaciones y servicios.</p>
    </header>

    {authLoading && <p className="messages-status">Comprobando sesión...</p>}
    {!authLoading && !isSupabaseConfigured && <p className="messages-status">Configura Supabase para usar la mensajería.</p>}
    {!authLoading && isSupabaseConfigured && !session && <div className="messages-status">
      <p>Inicia sesión para consultar tus conversaciones.</p>
      <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión <span aria-hidden="true">→</span></Link>
    </div>}

    {!authLoading && isSupabaseConfigured && session && <div className={`messages-layout${selectedConversationId ? ' thread-open' : ''}`}>
      <aside className="messages-inbox">
        <div className="messages-inbox-heading">
          <h2>Conversaciones</h2>
          <span title={totalUnread ? `${totalUnread} sin leer` : undefined}>{totalUnread || conversations.length}</span>
        </div>
        {conversations.length > 3 && <div className="messages-search">
          <input type="search" aria-label="Buscar conversaciones" placeholder="Buscar por nombre o servicio" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>}
        {conversationsLoading && <p className="messages-empty">Cargando conversaciones...</p>}
        {!conversationsLoading && !conversations.length && <p className="messages-empty">Todavía no tienes conversaciones. Contacta a un profesional desde una publicación.</p>}
        {!conversationsLoading && conversations.length > 0 && !visibleConversations.length && <p className="messages-empty">Sin resultados para "{search}".</p>}
        <div className="messages-conversation-list">
          {visibleConversations.map((conversation) => {
            const name = getCounterpartName(conversation, userId)
            const last = lastByConversation[conversation.id]
            const unread = unreadByConversation[conversation.id] || 0
            return <button
              className={`messages-conversation${conversation.id === selectedConversationId ? ' active' : ''}${unread ? ' unread' : ''}`}
              type="button"
              key={conversation.id}
              onClick={() => setSearchParams({ conversation: conversation.id })}
            >
              <span className="messages-avatar" aria-hidden="true">{getInitials(name)}</span>
              <span className="messages-conversation-copy">
                <span className="messages-conversation-top"><strong>{name}</strong><small>{formatInboxTime(last?.created_at || conversation.created_at)}</small></span>
                <span className="messages-conversation-service">{conversation.service_title}</span>
                <span className="messages-conversation-preview">
                  <span>{last ? `${last.sender_id === userId ? 'Tú: ' : ''}${last.content}` : 'Sin mensajes todavía'}</span>
                  {unread > 0 && <b aria-label={`${unread} sin leer`}>{unread > 99 ? '99+' : unread}</b>}
                </span>
              </span>
            </button>
          })}
        </div>
      </aside>

      <section className="messages-thread" aria-label="Conversación">
        {activeConversation ? <>
          <header className="messages-thread-heading">
            <button className="messages-back" type="button" aria-label="Volver a conversaciones" onClick={() => setSearchParams({})}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <div><span>Conversación con</span><h2>{counterpartName}</h2></div>
            <p>Publicación: <Link to={`/servicio/${activeConversation.service_id}`}>{activeConversation.service_title}</Link></p>
            <button className="messages-delete-conversation" type="button" disabled={deleting} onClick={handleDeleteConversation} aria-label="Eliminar conversación" title="Eliminar conversación para mí">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
            </button>
          </header>
          <div className="messages-feed" ref={feedRef} onScroll={handleFeedScroll} aria-live="polite">
            {messagesLoading && <p className="messages-first-note">Cargando mensajes...</p>}
            {!messagesLoading && !messages.length && <p className="messages-first-note">Envía un mensaje para iniciar la conversación sobre este servicio.</p>}
            {messages.map((message, index) => {
              const mine = message.sender_id === userId
              const newDay = index === 0 || dayKey(messages[index - 1].created_at) !== dayKey(message.created_at)
              return <div className="message-row" key={message.id}>
                {newDay && <div className="message-day"><span>{formatDayLabel(message.created_at)}</span></div>}
                <article className={`message-bubble${mine ? ' mine' : ''}`}>
                  <p>{message.content}</p>
                  <time dateTime={message.created_at}>
                    {formatMessageTime(message.created_at)}
                    {mine && <span className={`message-status${message.read_at ? ' is-read' : ''}`} aria-label={message.read_at ? 'Leído' : 'Enviado'} title={message.read_at ? 'Leído' : 'Enviado'}>
                      <svg aria-hidden="true" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {message.read_at ? <><path d="m1 8 5 5L18 1" /><path d="m8 12 4 4L23 5" /></> : <path d="m3 8 5 5L20 1" />}
                      </svg>
                    </span>}
                  </time>
                </article>
              </div>
            })}
          </div>
          {notice && <p className="messages-notice" role="alert">{notice}</p>}
          <form className="messages-composer" onSubmit={handleSend}>
            <div className="messages-emoji-picker">
              <button className="messages-emoji-toggle" type="button" aria-label="Insertar emoji" aria-expanded={emojiPickerOpen} aria-controls="messages-emoji-options" onClick={() => setEmojiPickerOpen((open) => !open)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></svg>
              </button>
              {emojiPickerOpen && <div className="messages-emoji-options" id="messages-emoji-options" role="group" aria-label="Emojis">
                {CHAT_EMOJIS.map((emoji) => <button type="button" key={emoji} aria-label={`Insertar ${emoji}`} onClick={() => addEmoji(emoji)}>{emoji}</button>)}
              </div>}
            </div>
            <textarea ref={textareaRef} aria-label="Escribe un mensaje" maxLength={4000} rows={2} placeholder="Escribe tu mensaje... (Enter envía, Shift+Enter salto de línea)" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} />
            <button type="submit" disabled={sending || !draft.trim()}>{sending ? 'Enviando...' : 'Enviar'}</button>
          </form>
        </> : <div className="messages-placeholder">
          <span aria-hidden="true">✉</span>
          <h2>Selecciona una conversación</h2>
          <p>Los mensajes se mantienen junto a la publicación correspondiente.</p>
        </div>}
      </section>
    </div>}

    {notice && !activeConversation && <p className="messages-notice" role="alert">{notice}</p>}
  </main>
}
