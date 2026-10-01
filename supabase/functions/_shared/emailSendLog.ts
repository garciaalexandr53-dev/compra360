import { createClient } from 'npm:@supabase/supabase-js@2'
import { EmailAPIError } from 'npm:@lovable.dev/email-js@0.1.0'
import { sendTemplateEmail } from './transactional-email-templates/send-email.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

export async function getCaller(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const c = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await c.auth.getUser(token)
  return error ? null : data.user
}

async function log(row: Record<string, unknown>) {
  const { error } = await serviceClient().from('email_send_log').insert(row)
  if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
}

/** Envia um template e registra o resultado no histórico de envios. */
export async function sendAndLog(
  templateName: string,
  to: string,
  opts: { templateData?: Record<string, unknown>; idempotencyKey: string },
) {
  const base = { message_id: null, template_name: templateName, recipient_email: to }
  try {
    const r = await sendTemplateEmail(templateName, to, opts)
    await log({ ...base, status: r.sent ? 'sent' : 'suppressed' })
    return r
  } catch (e) {
    const msg = e instanceof EmailAPIError ? `${e.code}: ${e.message}` : String((e as Error)?.message ?? e)
    await log({ ...base, status: 'failed', error_message: msg })
    throw e
  }
}
