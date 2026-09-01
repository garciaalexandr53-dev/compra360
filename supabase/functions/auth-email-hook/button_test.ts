import { assertEquals } from 'jsr:@std/assert@0.226.0'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { WelcomeEmail } from '../_shared/transactional-email-templates/welcome.tsx'

Deno.test('signup email renders bulletproof button with bgcolor', async () => {
  const html = await renderAsync(
    React.createElement(SignupEmail, {
      siteName: 'Compra360',
      siteUrl: 'https://compra360app.com.br',
      recipient: 'user@example.com',
      confirmationUrl: 'https://compra360app.com.br/confirm',
    })
  )
  // bgcolor HTML attribute is what Outlook honors for the filled button
  assertContains(html, 'bgcolor="#0F766C"')
  assertContains(html, 'href="https://compra360app.com.br/confirm"')
  assertContains(html, 'Confirmar email')
})

Deno.test('signup plain text keeps link label and url', async () => {
  const text = await renderAsync(
    React.createElement(SignupEmail, {
      siteName: 'Compra360',
      siteUrl: 'https://compra360app.com.br',
      recipient: 'user@example.com',
      confirmationUrl: 'https://compra360app.com.br/confirm',
    }),
    { plainText: true }
  )
  assertContains(text, 'Confirmar email')
  assertContains(text, 'https://compra360app.com.br/confirm')
})

Deno.test('welcome email renders bulletproof button with bgcolor', async () => {
  const html = await renderAsync(
    React.createElement(WelcomeEmail, { name: 'João' })
  )
  assertContains(html, 'bgcolor="#0F766C"')
  assertContains(html, 'Acessar o painel')
  assertContains(html, '/dashboard')
})

function assertContains(haystack: string, needle: string) {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`Expected rendered output to contain "${needle}". Got:\n${haystack.slice(0, 800)}`)
  }
}
