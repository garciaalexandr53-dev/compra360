/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

const LOGO_URL =
  'https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/email-assets/compra360-logo.png'

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração do seu email no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt={siteName} width="140" style={logo} />
        </Section>
        <Heading style={h1}>Confirme a alteração de email</Heading>
        <Text style={text}>
          Você solicitou alterar o email da sua conta no {siteName} de{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Clique no botão abaixo para confirmar a alteração:
        </Text>
        <Section style={{ textAlign: 'center' as const }}>
          <Button style={button} href={confirmationUrl}>
            Confirmar alteração
          </Button>
        </Section>
        <Text style={footer}>
          Se você não solicitou esta alteração, proteja sua conta alterando sua
          senha imediatamente.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const logoSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const logo = { display: 'inline-block' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(174, 78%, 26%)',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const text = {
  fontSize: '15px',
  color: 'hsl(221, 16%, 47%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'hsl(174, 78%, 26%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(174, 78%, 26%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(221, 16%, 60%)',
  margin: '32px 0 0',
  textAlign: 'center' as const,
}
