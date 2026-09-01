/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

/**
 * Botão "bulletproof" para e-mails.
 *
 * O `<Button>` do React Email gera uma `<a>` com `background-color` em inline style.
 * O Outlook (motor Word) ignora `background-color` em `<a>`, então o botão aparece
 * como texto puro. Esta implementação usa uma `<table>` com o atributo HTML
 * `bgcolor` no `<td>` (respeitado pelo Outlook), garantindo um bloco preenchido e
 * clicável em todos os clientes. Clientes modernos honram `border-radius`.
 */
interface BulletproofButtonProps {
  href: string
  children: React.ReactNode
  label?: string
}

const BTN_BG = '#0F766C' // hex sólido de hsl(174, 78%, 26%) — cor de marca
const BTN_BORDER = '#0C5F58'

const FONT_STACK =
  '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

export function BulletproofButton({ href, children, label }: BulletproofButtonProps) {
  const cellStyle = {
    backgroundColor: BTN_BG,
    borderRadius: '8px',
  } as React.CSSProperties

  const linkStyle = {
    backgroundColor: BTN_BG,
    backgroundImage: `linear-gradient(${BTN_BG}, ${BTN_BORDER})`,
    borderBottom: `2px solid ${BTN_BORDER}`,
    borderRadius: '8px',
    color: '#ffffff',
    display: 'inline-block',
    fontFamily: FONT_STACK,
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: '120%',
    padding: '14px 32px',
    textAlign: 'center',
    textDecoration: 'none',
    // Propriedades mso-* específicas do Outlook (não existem em CSSProperties)
    msoPaddingAlt: '0px',
    msoLineHeightRule: 'exactly',
  } as React.CSSProperties

  // `bgcolor` é um atributo HTML legado (lowercase) que o React repassa para o DOM
  // e que o Outlook honra — diferente de `background-color` em <a>, que é ignorado.
  const bgcolorAttr = { bgcolor: BTN_BG } as Record<string, string>

  return (
    <table
      role="presentation"
      align="center"
      border={0}
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: '0 auto' }}
    >
      <tbody>
        <tr>
          <td align="center" {...bgcolorAttr} style={cellStyle}>
            <a href={href} style={linkStyle} target="_blank" aria-label={label}>
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default BulletproofButton
