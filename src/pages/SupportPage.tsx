import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { SupportTicketsPanel } from '../components/SupportTicketsPanel'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'
import { telHref } from '../lib/telHref'

type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  text: string
}

function chatId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function autoReply(
  userText: string,
  displayName: string,
  supportPhone: string,
): string {
  const x = userText.toLowerCase()
  if (/password|reset|login|sign in|username/.test(x))
    return 'If you are signed in, open Settings → Security → Change password. If you forgot your password, use Sign in → Forgot username/password, or call us—we can verify your identity and send a reset link to the email on file.'
  if (/card|lost|stolen|lock|atm/.test(x))
    return 'If your card is lost or stolen, call the number on the back 24/7 or open Debit card after you sign in to lock the card and order a replacement.'
  if (/wire|swift|international/.test(x))
    return 'Domestic wires before 4 PM ET usually go out the same business day. International wires may need extra review. You can start both from Pay & transfer → Wire transfer.'
  if (/deposit|mobile|check/.test(x))
    return 'Most approved mobile deposits credit according to our funds availability policy. Larger amounts or new relationships may be subject to holds—your confirmation screen shows timing.'
  if (/dispute|charge|fraud|unauthorized/.test(x))
    return 'To dispute a charge, note the merchant, date, and amount—then use secure messaging or call us. For urgent fraud, use the Report fraud number on this page.'
  if (/tax|1099|form/.test(x))
    return 'Tax forms typically appear under Documents in January. You can download PDFs once they are posted.'
  if (/hello|hi\b|hey\b|good morning|good afternoon/.test(x))
    return `Hi ${displayName}! What would you like help with today?`
  if (/thank|thanks|bye|goodbye/.test(x))
    return 'You are welcome. Is there anything else I can help you with?'
  return `Thanks for the details. A specialist will review your message and follow up. For immediate help with passwords, cards, wires, deposits, disputes, or tax forms, call us at ${supportPhone}.`
}

const FAQ_ITEMS = [
  {
    id: '1',
    q: 'How do I reset my digital banking password?',
    a: 'Inside the app: Settings → Security → Change password. Locked out? Use the public Sign in screen → Forgot username/password, or phone us—we’ll validate you and email a reset link.',
    tags: 'password reset sign in login',
  },
  {
    id: '2',
    q: 'When does money from a mobile deposit land?',
    a: 'Released funds follow our availability policy; larger checks or newer relationships can earn holds. Your confirmation ticket spells out release timing.',
    tags: 'mobile deposit check funds hold',
  },
  {
    id: '3',
    q: 'Card missing—what now?',
    a: 'Dial the number molded on the plastic anytime, or—once signed in—visit Debit card to freeze, reorder, or tweak tap/travel preferences.',
    tags: 'card lost stolen lock debit credit',
  },
  {
    id: '4',
    q: 'Same-day wire cutoff?',
    a: 'Domestic wires filed before 4:00 PM ET usually depart that business day. Cross-border wires may pause for compliance seasoning.',
    tags: 'wire transfer international domestic cutoff',
  },
  {
    id: '5',
    q: 'How do I challenge a charge?',
    a: 'Tap the ledger entry → Dispute, or ping us securely with merchant, date, and amount.',
    tags: 'dispute charge fraud transaction',
  },
  {
    id: '6',
    q: 'Where do tax slips live?',
    a: 'January brings PDFs under Documents for the prior calendar year—download when posted.',
    tags: 'tax 1099 ira form document',
  },
] as const

const TOPICS = [
  {
    title: 'Plastic & cash machines',
    body: 'Freeze spending power, schedule travel, swap damaged plastic, tame ATM quirks.',
    icon: '◆',
  },
  {
    title: 'Digital channels',
    body: 'Payees, movement of funds, nudges, biometrics, stubborn browsers.',
    icon: '◇',
  },
  {
    title: 'Borrowing desk',
    body: 'Homes, autos, unsecured notes, line draws—anything with a coupon.',
    icon: '○',
  },
  {
    title: 'Investments & planning',
    body: 'IRA flows, beneficiary hygiene, statements, advisor cadence.',
    icon: '◎',
  },
] as const

function matchesSearch(item: (typeof FAQ_ITEMS)[number], query: string): boolean {
  if (!query.trim()) return true
  const t = `${item.q} ${item.a} ${item.tags}`.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w))
}

export function SupportPage() {
  const { displayName } = useAuth()
  const cfg = useBankConfig()
  const [mainTab, setMainTab] = useState<'help' | 'tickets'>('help')
  const [faqQuery, setFaqQuery] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageSent, setMessageSent] = useState(false)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('10:00')
  const [apptTopic, setApptTopic] = useState('general')
  const [apptConfirmed, setApptConfirmed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatTyping, setChatTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const filteredFaq = useMemo(
    () => FAQ_ITEMS.filter((item) => matchesSearch(item, faqQuery)),
    [faqQuery],
  )

  function handleSendMessage(e: FormEvent) {
    e.preventDefault()
    if (!messageBody.trim()) return
    setMessageSent(true)
    setMessageBody('')
  }

  function handleSchedule(e: FormEvent) {
    e.preventDefault()
    if (!apptDate.trim()) return
    setApptConfirmed(true)
  }

  function openChat() {
    setChatOpen(true)
    setChatMessages((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              id: chatId(),
              role: 'agent',
              text: `Hi ${displayName}! I am ${cfg.chatAgentName} with ${cfg.bankNameShort} virtual support. Ask me about banking basics, or type what you need help with.`,
            },
          ],
    )
  }

  function closeChat() {
    setChatOpen(false)
    setChatTyping(false)
  }

  function handleChatSubmit(e: FormEvent) {
    e.preventDefault()
    const t = chatInput.trim()
    if (!t || chatTyping) return
    const userMsg: ChatMessage = { id: chatId(), role: 'user', text: t }
    setChatMessages((m) => [...m, userMsg])
    setChatInput('')
    setChatTyping(true)
    window.setTimeout(() => {
      setChatTyping(false)
      setChatMessages((m) => [
        ...m,
        {
          id: chatId(),
          role: 'agent',
          text: autoReply(t, displayName, cfg.supportPhone),
        },
      ])
    }, 1_100)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatTyping, chatOpen])

  useEffect(() => {
    if (!chatOpen) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') closeChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
            Support
          </h1>
          <p className="mt-1 text-bw-muted">
            We are here to help, {displayName}. Chat responses are automated for
            common questions; a banker can take over when you need more depth.
          </p>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center justify-center rounded-md border border-bw-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-bw-navy-900 shadow-sm hover:bg-bw-sand-100"
        >
          ← Back to accounts
        </Link>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-bw-sand-200 pb-1"
        role="tablist"
        aria-label="Support sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'help'}
          onClick={() => setMainTab('help')}
          className={[
            'rounded-t-lg px-4 py-2.5 text-sm font-semibold transition',
            mainTab === 'help'
              ? 'bg-bw-navy-900 text-white shadow-sm'
              : 'text-bw-muted hover:bg-bw-sand-100 hover:text-bw-navy-900',
          ].join(' ')}
        >
          Help &amp; chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'tickets'}
          onClick={() => setMainTab('tickets')}
          className={[
            'rounded-t-lg px-4 py-2.5 text-sm font-semibold transition',
            mainTab === 'tickets'
              ? 'bg-bw-navy-900 text-white shadow-sm'
              : 'text-bw-muted hover:bg-bw-sand-100 hover:text-bw-navy-900',
          ].join(' ')}
        >
          My tickets
        </button>
      </div>

      {mainTab === 'tickets' ? (
        <SupportTicketsPanel />
      ) : null}

      {mainTab === 'help' ? (
        <>
      <div className="grid gap-4 sm:grid-cols-3">
        <a
          href={telHref(cfg.supportPhone)}
          className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm transition hover:border-bw-blue-500/40 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
            Call us
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-bw-navy-900">
            {cfg.supportPhone}
          </p>
          <p className="mt-1 text-sm text-bw-muted">{cfg.supportHoursLine}</p>
        </a>
        <div className="rounded-xl border border-bw-sand-200 bg-bw-sky-100/50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
            Live chat
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-bw-navy-900">
            Online now
          </p>
          <p className="mt-1 text-sm text-bw-muted">
            Typical wait under a few minutes during business hours. After hours,
            leave a secure message and we will respond the next business day.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-bw-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-bw-navy-800"
            onClick={openChat}
          >
            Start chat
          </button>
        </div>
        <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
            Visit us
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-bw-navy-900">
            Branches &amp; ATMs
          </p>
          <p className="mt-1 text-sm text-bw-muted">
            Search locations, hours, and services near you.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-bw-sand-200 px-4 py-2 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
          >
            Find a location
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Search help articles
            </h2>
            <label className="sr-only" htmlFor="faq-search">
              Search questions
            </label>
            <input
              id="faq-search"
              type="search"
              placeholder={'Try "password", "wire", or "dispute"…'}
              className="mt-3 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
            />
            <ul className="mt-6 space-y-4">
              {filteredFaq.length === 0 ? (
                <li className="text-sm text-bw-muted">
                  No articles match that search. Try different words or contact
                  us below.
                </li>
              ) : (
                filteredFaq.map((item) => (
                  <li
                    key={item.id}
                    className="border-b border-bw-sand-200 pb-4 last:border-0 last:pb-0"
                  >
                    <p className="font-semibold text-bw-navy-900">{item.q}</p>
                    <p className="mt-2 text-sm leading-relaxed text-bw-muted">
                      {item.a}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Popular topics
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {TOPICS.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  className="rounded-lg border border-bw-sand-200 bg-bw-sand-100/40 p-4 text-left transition hover:border-bw-blue-500/30 hover:bg-bw-sky-100/40"
                >
                  <span className="text-lg text-bw-blue-600" aria-hidden>
                    {t.icon}
                  </span>
                  <p className="mt-2 font-semibold text-bw-navy-900">{t.title}</p>
                  <p className="mt-1 text-sm text-bw-muted">{t.body}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Secure message
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              Send a private note to our service team. Messages are transmitted
              securely and retained per our records policy.
            </p>
            {messageSent && (
              <p
                className="mt-3 rounded-md border border-bw-blue-500/20 bg-bw-sky-100 px-3 py-2 text-sm text-bw-navy-900"
                role="status"
              >
                Message sent. A specialist typically replies within one business
                day.
              </p>
            )}
            <form className="mt-4 space-y-3" onSubmit={handleSendMessage}>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                placeholder="How can we help?"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                aria-label="Secure message"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-bw-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-red-600"
              >
                Send message
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Schedule a call
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              Book a time for mortgage, small business, or wealth questions.
            </p>
            {apptConfirmed && (
              <p
                className="mt-3 rounded-md border border-bw-blue-500/20 bg-bw-sky-100 px-3 py-2 text-sm text-bw-navy-900"
                role="status"
              >
                You are scheduled for {apptDate} at {apptTime}. We will call you
                at the number on file.
              </p>
            )}
            <form className="mt-4 space-y-3" onSubmit={handleSchedule}>
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="appt-topic"
                >
                  Topic
                </label>
                <select
                  id="appt-topic"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={apptTopic}
                  onChange={(e) => setApptTopic(e.target.value)}
                >
                  <option value="general">General banking</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="business">Small business</option>
                  <option value="wealth">Wealth &amp; invest</option>
                </select>
              </div>
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="appt-date"
                >
                  Preferred date
                </label>
                <input
                  id="appt-date"
                  type="date"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="appt-time"
                >
                  Time (ET)
                </label>
                <select
                  id="appt-time"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={apptTime}
                  onChange={(e) => setApptTime(e.target.value)}
                >
                  {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t} ET
                      </option>
                    ),
                  )}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
              >
                Confirm appointment
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-bw-red-600/20 bg-red-50/80 p-5">
            <h3 className="text-sm font-semibold text-bw-red-800">
              Report fraud
            </h3>
            <p className="mt-2 text-sm text-bw-muted">
              If you see charges you did not make, call{' '}
              <a
                href={telHref(cfg.supportPhoneFraud)}
                className="font-semibold text-bw-navy-900 underline"
              >
                {cfg.supportPhoneFraud}
              </a>{' '}
              immediately, 24/7.
            </p>
          </div>
        </aside>
      </div>

      <p className="text-xs leading-relaxed text-bw-muted">
        {cfg.bankName} will never ask for your full card number or password in
        chat. For sensitive matters, sign in to online banking or call the number
        on your statement.
      </p>
        </>
      ) : null}

      {mainTab === 'help' && chatOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[120] bg-bw-navy-950/40 backdrop-blur-[1px] sm:pointer-events-none sm:bg-transparent sm:backdrop-blur-none"
            aria-label="Close chat"
            onClick={closeChat}
          />
          <div
            className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[130] flex max-h-[85dvh] flex-col rounded-t-2xl border border-bw-sand-200 bg-white shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-h-[78vh] sm:w-full sm:max-w-md sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Live chat with ${cfg.bankNameShort} support`}
          >
            <div className="flex items-center justify-between border-b border-bw-sand-200 bg-bw-navy-900 px-4 py-3 text-white sm:rounded-t-2xl">
              <div>
                <p className="font-display text-sm font-semibold">
                  {cfg.chatHeaderTitle}
                </p>
                <p className="text-xs text-white/75">
                  {cfg.chatAgentName} · {cfg.chatHeaderSubtitle}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-medium text-white/90 hover:bg-white/10"
                onClick={closeChat}
              >
                Close
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-3 overflow-y-auto bg-bw-sand-100/60 p-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={
                      msg.role === 'user'
                        ? 'ml-6 rounded-lg bg-bw-sky-100 px-3 py-2 text-sm text-bw-navy-900'
                        : 'mr-6 rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-sm text-bw-navy-900 shadow-sm'
                    }
                  >
                    {msg.text}
                  </div>
                ))}
                {chatTyping && (
                  <div className="mr-6 rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-sm text-bw-muted shadow-sm">
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">
                        {cfg.chatAgentName} is typing
                      </span>
                      <span className="inline-flex translate-y-0.5 gap-0.5">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-bw-muted [animation-delay:-0.3s]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-bw-muted [animation-delay:-0.15s]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-bw-muted" />
                      </span>
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form
                className="border-t border-bw-sand-200 bg-white p-3"
                onSubmit={handleChatSubmit}
              >
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="chat-input">
                    Type a message
                  </label>
                  <input
                    id="chat-input"
                    className="min-w-0 flex-1 rounded-md border border-bw-sand-200 px-3 py-2 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                    placeholder="Type a message…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    autoComplete="off"
                    disabled={chatTyping}
                  />
                  <button
                    type="submit"
                    disabled={chatTyping || !chatInput.trim()}
                    className="shrink-0 rounded-md bg-bw-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bw-red-600 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-bw-muted">
                  Encrypted session · do not include full card numbers or
                  passwords
                </p>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

