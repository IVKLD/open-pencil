/** Safely evaluates basic arithmetic expressions (+, -, *, /, parentheses) */
export function safeEvalArithmetic(input: string): number | null {
  let pos = 0
  const str = input.replace(/\s+/g, '')
  if (!str) return null

  function parseFactor(): number {
    if (pos >= str.length) throw new Error('Unexpected end of input')
    if (str[pos] === '+') {
      pos++
      return parseFactor()
    }
    if (str[pos] === '-') {
      pos++
      return -parseFactor()
    }
    if (str[pos] === '(') {
      pos++
      const val = parseExpr()
      if (str[pos] !== ')') throw new Error('Expected )')
      pos++
      return val
    }
    const start = pos
    while (pos < str.length && /[\d.]/.test(str[pos])) pos++
    if (start === pos) throw new Error(`Unexpected char: ${str[pos]}`)
    const num = Number(str.slice(start, pos))
    if (!Number.isFinite(num)) throw new Error('Invalid number')
    return num
  }

  function parseTerm(): number {
    let val = parseFactor()
    while (pos < str.length && (str[pos] === '*' || str[pos] === '/')) {
      const op = str[pos++]
      const next = parseFactor()
      val = op === '*' ? val * next : next !== 0 ? val / next : 0
    }
    return val
  }

  function parseExpr(): number {
    let val = parseTerm()
    while (pos < str.length && (str[pos] === '+' || str[pos] === '-')) {
      const op = str[pos++]
      const next = parseTerm()
      val = op === '+' ? val + next : val - next
    }
    return val
  }

  try {
    const result = parseExpr()
    return pos === str.length ? result : null
  } catch {
    return null
  }
}

/** Parses coordinate values or Shadr screen expressions (e.g. "1920/2 - 130", "26 + 72 * 0.9") */
export function parseCoordinate(val: number | string | undefined, defaultValue = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : defaultValue
  if (!val) return defaultValue

  const normalized = String(val)
    .replace(/halfWidth/gi, '960')
    .replace(/halfHeight/gi, '540')
    .replace(/1920\/2/g, '960')
    .replace(/1080\/2/g, '540')

  if (/^[\d\s.+\-*/()]+$/.test(normalized)) {
    const evaluated = safeEvalArithmetic(normalized)
    if (evaluated !== null && Number.isFinite(evaluated)) {
      return evaluated
    }
  }

  const num = Number(val)
  return Number.isFinite(num) ? num : defaultValue
}

