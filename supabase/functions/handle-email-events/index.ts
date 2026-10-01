import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Mantém o histórico de bloqueios e envios do projeto (somente registro).
async function registrar(
  eventId: string,
  recipient: string,
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  status: 'bounced' | 'complained' | 'suppressed',
  message: string,
) {
  const email = recipient.toLowerCase()
  const { error: e1 } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (e1) {
    console.error('suppressed_emails upsert failed', { code: e1.code, message: e1.message, event_id: eventId })
    throw new Error('suppressed_emails upsert failed')
  }
  const { error: e2 } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status,
    error_message: message,
    metadata: null,
  })
  if (e2) {
    console.error('email_send_log insert failed', { code: e2.code, message: e2.message, event_id: eventId })
    throw new Error('email_send_log insert failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await registrar(event.event_id, event.data.recipient, 'bounce', 'bounced',
        'Permanent bounce — email address is invalid or rejected')
    },
    'email.complaint': async (event) => {
      await registrar(event.event_id, event.data.recipient, 'complaint', 'complained',
        'Spam complaint — recipient marked email as spam')
    },
    'email.unsubscribed': async (event) => {
      await registrar(event.event_id, event.data.recipient, 'unsubscribe', 'suppressed',
        'Recipient unsubscribed')
    },
  },
})

Deno.serve((req) => handler(req))
