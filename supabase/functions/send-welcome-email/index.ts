import { corsHeaders, getCaller, json, sendAndLog } from '../_shared/emailSendLog.ts'

// Boas-vindas: sempre para o próprio usuário autenticado, uma única vez.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const user = await getCaller(req)
  if (!user?.email) return json({ error: 'Não autenticado' }, 401)
  if (!user.email_confirmed_at) return json({ success: false, reason: 'email_not_confirmed' })
  try {
    const r = await sendAndLog('welcome', user.email, { templateData: {}, idempotencyKey: `welcome-${user.id}` })
    return json({ success: r.sent })
  } catch (e) {
    console.error('welcome send failed', (e as Error)?.message)
    return json({ error: 'Falha ao enviar' }, 500)
  }
})
