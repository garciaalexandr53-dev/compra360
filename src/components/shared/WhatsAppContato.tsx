export const WhatsAppIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88zm8.41-18.3A11.8 11.8 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41z" />
  </svg>
);

/** Rodapé "Dúvidas? Fale com a gente no WhatsApp" com ícone clicável. */
const WhatsAppContato = ({ className = "mt-8" }: { className?: string }) => (
  <div className={`text-center text-sm text-slate-500 ${className}`}>
    <p className="mb-3">Dúvidas? Fale com a gente no WhatsApp</p>
    <a
      href="https://wa.me/5544984483553"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp (44) 98448-3553"
      className="inline-flex items-center gap-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 shadow-lg shadow-emerald-500/20 transition-colors"
    >
      <WhatsAppIcon className="h-6 w-6" />
      <span className="whitespace-nowrap">(44)&nbsp;98448-3553</span>
    </a>
  </div>
);

export default WhatsAppContato;
