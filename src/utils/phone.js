// Teléfono de contacto: se acepta con o sin +56, espacios, guiones o paréntesis.
const PHONE_PATTERN = /^\+?[0-9 ()-]{8,20}$/

export function validatePhone(value) {
  const phone = String(value || '').trim()
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!PHONE_PATTERN.test(phone) || digits.length < 8 || digits.length > 15) return 'Escribe un teléfono válido, por ejemplo +56 9 1234 5678.'
  return ''
}

// Enlace de WhatsApp (wa.me exige el número solo con dígitos y código de país). Un móvil chileno de 9 dígitos que parte en 9 recibe el 56.
export function whatsappUrl(value, text) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 8) return ''
  if (digits.length === 9 && digits.startsWith('9')) digits = `56${digits}`
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
