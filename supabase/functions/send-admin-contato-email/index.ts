import { corsHeaders, getCaller, json, sendAndLog, serviceClient } from '../_shared/emailSendLog.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Contato do Painel Admin com um cliente: só administradores.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Não autenticado' }, 401)
  const { data: role } = await serviceClient()
    .from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'admin').maybeSingle()
  if (!role) return json({ error: 'Acesso restrito a administradores' }, 403)

  const body = await req.json().catch(() => null)
  const to = typeof body?.recipientEmail === 'string' ? body.recipientEmail.trim() : ''
  const titulo = typeof body?.titulo === 'string' ? body.titulo.slice(0, 200) : ''
  const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.slice(0, 10000) : ''
  const key = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 200) : crypto.randomUUID()
  if (!EMAIL_RE.test(to) || to.length > 254) return json({ error: 'E-mail inválido' }, 400)
  if (!mensagem) return json({ error: 'Mensagem obrigatória' }, 400)

  try {
    const r = await sendAndLog('notification', to, { templateData: { titulo, mensagem }, idempotencyKey: key })
    return json({ success: r.sent, reason: r.sent ? undefined : 'email_suppressed' })
  } catch (e) {
    console.error('contato send failed', (e as Error)?.message)
    return json({ error: 'Falha ao enviar' }, 500)
  }
})
