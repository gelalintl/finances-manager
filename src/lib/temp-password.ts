const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SPECIAL = '!@#$%&*?-_'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

function randomIndex(max: number) {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % max
}

function pick(chars: string) {
  return chars[randomIndex(chars.length)]
}

/** Mot de passe provisoire conforme à `passwordSchema`, sans caractères ambigus (0/O, 1/l/I). */
export function generateTempPassword(length = 12) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)]
  while (chars.length < length) chars.push(pick(ALL))

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
