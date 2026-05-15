import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, MailX } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'submitting' | 'success' | 'error';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErrorMsg(data?.error || 'Token inválido');
          setStatus('invalid');
          return;
        }
        setEmail(data?.email || null);
        if (data?.alreadyUnsubscribed) setStatus('already');
        else setStatus('valid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleConfirm = async () => {
    setStatus('submitting');
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
    if (error || (data as any)?.error) {
      setErrorMsg(error?.message || (data as any)?.error || 'Erro ao processar');
      setStatus('error');
      return;
    }
    setStatus('success');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {status === 'loading' || status === 'submitting' ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
             status === 'success' || status === 'already' ? <MailX className="h-6 w-6 text-primary" /> :
             status === 'invalid' || status === 'error' ? <XCircle className="h-6 w-6 text-destructive" /> :
             <CheckCircle2 className="h-6 w-6 text-primary" />}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verificando link…'}
            {status === 'valid' && 'Cancelar e-mails do Compra360'}
            {status === 'submitting' && 'Processando…'}
            {status === 'success' && 'E-mails cancelados'}
            {status === 'already' && 'Você já cancelou'}
            {status === 'invalid' && 'Link inválido'}
            {status === 'error' && 'Não foi possível processar'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'valid' && (
            <>
              <p className="text-sm text-muted-foreground">
                {email ? <>Confirme o cancelamento dos e-mails enviados para <strong>{email}</strong>.</> :
                  'Confirme o cancelamento dos e-mails de notificação.'}
              </p>
              <Button onClick={handleConfirm} className="w-full">Confirmar cancelamento</Button>
            </>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Pronto! Você não receberá mais e-mails de notificação{email ? <> em <strong>{email}</strong></> : ''}.
            </p>
          )}
          {status === 'already' && (
            <p className="text-sm text-muted-foreground">
              Este e-mail{email ? <> (<strong>{email}</strong>)</> : ''} já está cancelado.
            </p>
          )}
          {(status === 'invalid' || status === 'error') && (
            <p className="text-sm text-muted-foreground">{errorMsg || 'Verifique o link recebido no e-mail.'}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
