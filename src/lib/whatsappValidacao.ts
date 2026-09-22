/** DDDs válidos no Brasil. */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68,
  69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95,
  96, 97, 98, 99,
]);

const SEQUENCIAS_FALSAS = ["0123456789", "1234567890", "9876543210", "12345678"];

/** Validação estrutural do WhatsApp (DDD, 9º dígito e sequências óbvias). */
export function validarWhatsApp(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length < 10) return "Informe o WhatsApp com DDD.";
  if (d.length > 11) return "WhatsApp com dígitos demais.";
  const ddd = Number(d.slice(0, 2));
  if (!DDDS_VALIDOS.has(ddd)) return "DDD inexistente no Brasil.";
  const numero = d.slice(2);
  if (numero.length === 9 && numero[0] !== "9") return "Celular deve começar com 9 depois do DDD.";
  if (/^(\d)\1+$/.test(numero)) return "Número inválido.";
  if (SEQUENCIAS_FALSAS.some((s) => numero.includes(s))) return "Número inválido.";
  return null;
}
