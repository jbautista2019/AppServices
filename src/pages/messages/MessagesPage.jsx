import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { getConversationMessages, getUserConversations, isSupabaseConfigured, sendConversationMessage, supabase } from '../../utils/supabase'

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

export default function MessagesPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedConversationId = searchParams.get('conversation')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const bottomRef = useRef(null)

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

  useEffect(() => {
    if (!session?.user?.id) {
      setConversations([])
      return
    }

    let active = true
    setConversationsLoading(true)
    getUserConversations().then(({ data, error }) => {
      if (!active) return
      if (error) setNotice('No se pudieron cargar las conversaciones. Verifica el esquema de mensajería en Supabase.')
      else setConversations(data || [])
      setConversationsLoading(false)
    }).catch(() => {
      if (!active) return
      setNotice('No se pudieron cargar las conversaciones.')
      setConversationsLoading(false)
    })

    return () => { active = false }
  }, [session?.user?.id])

  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId)

  useEffect(() => {
    if (!selectedConversationId && conversations.length) {
      setSearchParams({ conversation: conversations[0].id }, { replace: true })
    }
  }, [conversations, selectedConversationId, setSearchParams])

  useEffect(() => {
    if (!activeConversation || !supabase) {
      setMessages([])
      return
    }

    let active = true
    async function loadMessages() {
      const { data, error } = await getConversationMessages(activeConversation.id)
      if (!active) return
      if (error) setNotice('No se pudieron cargar los mensajes de esta conversación.')
      else setMessages(data || [])
    }

    loadMessages().catch(() => {
      if (active) setNotice('No se pudieron cargar los mensajes de esta conversación.')
    })

    const channel = supabase
      .channel(`conversation-${activeConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConversation.id}`,
      }, () => loadMessages())
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [activeConversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  async function handleSend(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !activeConversation || !session || sending) return

    setSending(true)
    setNotice('')
    const { error } = await sendConversationMessage(activeConversation.id, session.user.id, content)
    if (error) {
      setNotice('No se pudo enviar el mensaje. Inténtalo de nuevo.')
    } else {
      setDraft('')
      const { data } = await getConversationMessages(activeConversation.id)
      setMessages(data || [])
    }
    setSending(false)
  }

  const counterpartName = activeConversation && session
    ? getCounterpartName(activeConversation, session.user.id)
    : ''

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

    {!authLoading && isSupabaseConfigured && session && <div className="messages-layout">
      <aside className="messages-inbox">
        <div className="messages-inbox-heading"><h2>Conversaciones</h2><span>{conversations.length}</span></div>
        {conversationsLoading && <p className="messages-empty">Cargando conversaciones...</p>}
        {!conversationsLoading && !conversations.length && <p className="messages-empty">Todavía no tienes conversaciones. Contacta a un profesional desde una publicación.</p>}
        <div className="messages-conversation-list">
          {conversations.map((conversation) => {
            const name = getCounterpartName(conversation, session.user.id)
            return <button
              className={`messages-conversation${conversation.id === selectedConversationId ? ' active' : ''}`}
              type="button"
              key={conversation.id}
              onClick={() => setSearchParams({ conversation: conversation.id })}
            >
              <span className="messages-avatar" aria-hidden="true">{getInitials(name)}</span>
              <span className="messages-conversation-copy">
                <strong>{name}</strong>
                <span>{conversation.service_title}</span>
                <small>{new Date(conversation.created_at).toLocaleDateString('es-CL')}</small>
              </span>
            </button>
          })}
        </div>
      </aside>

      <section className="messages-thread" aria-label="Conversación">
        {activeConversation ? <>
          <header className="messages-thread-heading">
            <div><span>Conversación con</span><h2>{counterpartName}</h2></div>
            <p>Publicación: <Link to={`/servicio/${activeConversation.service_id}`}>{activeConversation.service_title}</Link></p>
          </header>
          <div className="messages-feed" aria-live="polite">
            {!messages.length && <p className="messages-first-note">Envía un mensaje para iniciar la conversación sobre este servicio.</p>}
            {messages.map((message) => <article className={`message-bubble${message.sender_id === session.user.id ? ' mine' : ''}`} key={message.id}>
              <p>{message.content}</p>
              <time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
            </article>)}
            <div ref={bottomRef} />
          </div>
          {notice && <p className="messages-notice" role="alert">{notice}</p>}
          <form className="messages-composer" onSubmit={handleSend}>
            <textarea aria-label="Escribe un mensaje" maxLength={4000} rows={2} placeholder="Escribe tu mensaje..." value={draft} onChange={(event) => setDraft(event.target.value)} />
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