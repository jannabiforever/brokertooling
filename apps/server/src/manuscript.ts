import type * as Api from "@personalos/api"

// Manuscript = the text form shared by 해설 원고 and problem transcripts:
// one line = one paragraph, `$…$` = equation in 한글 수식 편집기 syntax.
// `format` rewrites everything that has exactly one correct form under the
// 원고 rules; `lint` (a port of the haeseol-wongo skill's check.py, same rule
// names) reports what is left: unbalanced `$`/braces/LEFT·RIGHT and prose
// that should have been an equation, which only the author can settle.

const COMMANDS = new Set([
  "times",
  "div",
  "over",
  "RARROW",
  "LARROW",
  "LRARROW",
  "leq",
  "geq",
  "because",
  "therefore",
  "~~",
  "~",
])

const ARROW = /\b(RARROW|LARROW|LRARROW)\b/
const FIGURE_LINE = /^\[(그림|표)( \d+)?:/

const count = (s: string, re: RegExp): number => Array.from(s.matchAll(re)).length
const isAlnum = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c)

/** LaTeX habits → 한글 수식 spellings; a backslash that survives is left for lint. */
const fromLatex = (eq: string): string =>
  eq
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "{$1} over {$2}")
    .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "root {$1} of {$2}")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt {$1}")
    .replace(/\\left\s*([(["|])/g, "LEFT$1 ")
    .replace(/\\right\s*([)\]|])/g, " RIGHT$1")
    .replace(/\\infty\b/g, "inf")
    .replace(/\\to\b/g, "->")
    .replace(/\\ne(?:q)?\b/g, "!=")
    .replace(/\\le\b/g, "leq")
    .replace(/\\ge\b/g, "geq")
    .replace(/\\([A-Za-z]+)(?=\S)/g, "$1 ") // \lim_{…} → lim _{…}
    .replace(/\\([A-Za-z]+)/g, "$1") // alpha, pi, times, sin, int, therefore…

/** Coefficient tokens that need a backtick before sin·cos·tan·log·ln. */
const needsBacktick = (t: string): boolean =>
  (!COMMANDS.has(t) && isAlnum(t.at(-1))) ||
  ((t.endsWith("}") || t.endsWith(")")) && !t.startsWith("_{") && !t.startsWith("^{"))

/**
 * One equation body, given the character after its closing `$` and the text
 * before its opening `$` (the 수식 끝 / 제n항 rules depend on them).
 */
const fixEquation = (raw: string, next: string, prev: string): string => {
  let eq = fromLatex(raw)
    .replace(/overline/g, "bar")
    .replace(/\bneq\b/g, "!=")
    .replace(/<=/g, " leq ")
    .replace(/>=/g, " geq ")
    .replace(/<\s*-/g, "{<}-") // `<-` typesets as an arrow
    // commands glued to their argument
    .replace(/(?<![A-Za-z])(n|\d)pi\b/g, "$1 pi")
    .replace(/\b(sin|cos|tan)x\b/g, "$1`x")
    .replace(/([a-z])(sin|cos|tan)\b/g, "$1`$2")
    // bare sub/superscripts
    .replace(/([_^])\s*([A-Za-z0-9])(?![\w{])/g, " $1{$2}")
    // every bracket is LEFT( … RIGHT)
    .replace(/(?<!\bLEFT\s*)([([])/gi, " LEFT$1 ")
    .replace(/(?<!\bRIGHT\s*)([)\]])/gi, " RIGHT$1")
    // fractions: both sides braced
    .replace(/([^\s{}]+)\s+over\s+([^\s{}]+)/g, "{$1} over {$2}")
    .replace(/\}\s*over\s+([^\s{}]+)/g, "} over {$1}")
    .replace(/([^\s{}]+)\s+over\s*\{/g, "{$1} over {")
    // sin·cos·tan and their angle; coefficient before a function name
    .replace(
      /\b(sin|cos|tan)(\s*\^\s*\{[^}]*\})?\s*(?=[^\s`})])/g,
      (_, fn: string, power?: string) => `${fn}${power ?? ""}\``,
    )
    .replace(/([0-9)}])(sin|cos|tan|log|ln)\b/g, "$1`$2")
    .replace(/(\S+)\s+(sin|cos|tan|log|ln)\b/g, (m, t: string, fn: string) =>
      needsBacktick(t) ? `${t}\`${fn}` : m,
    )
    // log base, limit arrow
    .replace(/log\s*_\s*\{\s*`?([^}`]*?)`?\s*\}/g, "log _{`$1`}")
    .replace(/\s*`*->`*\s*/g, "`->`")
  if (!/^\s*(therefore|because)\s*$/.test(eq)) {
    eq = eq.replace(/\b(therefore|because)(?!\s*``)\s*`?/g, "$1``")
  }
  if (!eq.includes("rm")) {
    eq = eq
      .replace(/(?<![`'])'/g, "`'")
      .replace(/(?<![A-Za-z])([CEPQRS])(?!\s*[`_^])(?![A-Za-z])/g, "$1`")
  }
  // coordinates and intervals: one backtick before the comma, two after
  eq = eq.replace(
    /(\s*)`*,`*(\s*)/g,
    (_, before: string, after: string) => `${before && " "}\`,\`\`${after && " "}`,
  )
  if (eq.includes("cases")) eq = eq.replace(/(?<!&\s*)#(?!\s*&\s*#)/g, "# & #")
  eq = eq
    .replace(/(\brm\s+[A-Za-z]+\s*\}?[\s`]*)(?=LEFT\b)/g, "$1it ")
    .replace(/(\brm\s+[A-Za-z]+\s*\}?[\s`]*_\s*\{)(?!\s*it\b)/g, "$1it ")
    .replace(/ {2,}/g, " ")
  // 수식 끝: a backtick when a letter or punctuation follows, none before a space
  const body = eq.trimEnd()
  const attached = next !== "" && !/\s/.test(next)
  if (attached) {
    if (!body.endsWith("`")) eq = body + "`"
    else if (/(?<![A-Za-z])[CEPQRS]`$/.test(body) && !eq.includes("rm")) eq = body + "`"
  } else if (!body.trimStart().startsWith("therefore")) {
    eq = body.replace(/`+$/, "")
  }
  if (prev.endsWith("제") && (next === "항" || next === "사") && !eq.trimStart().startsWith("`")) {
    eq = "`" + eq.trimStart()
  }
  return eq
}

/** One manuscript line; `undefined` drops it. */
const fixLine = (raw: string): string | undefined => {
  const line = raw.replace(/\t/g, "    ").trimEnd()
  if (FIGURE_LINE.test(line)) return line // notes for the illustrator, not manuscript
  if (/^(코드|정답)\s*:/.test(line)) return undefined // header lines the 원고 forbids
  const s = line.replace(
    /([①-⑳㉠-㉻]|\((?:가|나|다|라|마|바|사)\))(?!\[반띄쓰\])(?=[^\s,.)\]])/g,
    "$1[반띄쓰]",
  )
  if (count(s, /\$/g) % 2 === 1) return s // lint will say so
  // `$A RARROW B$` → `$A$   $RARROW$   $B$`
  const split = s.split("$")
  for (let k = 1; k < split.length; k += 2) {
    const eq = split[k] ?? ""
    if (ARROW.test(eq) && !/^\s*(RARROW|LARROW|LRARROW)\s*$/.test(eq) && !eq.includes("eqalign")) {
      split[k] = eq.replace(
        /\s*\b(RARROW|LARROW|LRARROW)\b\s*/g,
        (_, arrow: string) => `$   $${arrow}$   $`,
      )
    }
  }
  const parts = split.join("$").split("$")
  for (let k = 1; k < parts.length; k += 2) {
    parts[k] = fixEquation(parts[k] ?? "", (parts[k + 1] ?? "").charAt(0), parts[k - 1] ?? "")
  }
  let fixed = parts
    .join("$")
    .replace(/\$ *(\$(?:RARROW|LARROW|LRARROW)\$) *\$/g, (_, arrow: string) => `$   ${arrow}   $`)
  const equations = parts.filter((_, k) => k % 2 === 1).join("")
  if (/[가-힣]/.test(equations) && !fixed.includes("<<일러")) fixed += " <<일러"
  return fixed
}

/**
 * Normalizes a manuscript: code fences, CRLF, tabs, trailing spaces, and the
 * 수식 문법·띄어쓰기 rules that have exactly one correct form. Idempotent.
 */
export const format = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/^```[^\n]*\n|\n```\s*$/g, "") // models sometimes fence the output
    .split("\n")
    .map(fixLine)
    .filter((line): line is string => line !== undefined)
    .join("\n")
    .trimEnd()

const checkEquation = (eq: string, next: string, prev: string, warn: (rule: string) => void) => {
  const body = eq.trim()
  if (eq.includes("\\")) warn("LaTeX 역슬래시")
  if (count(eq, /\{/g) !== count(eq, /\}/g)) warn("중괄호 짝")
  if (/(?<![A-Za-z])(n|\d)pi\b|[a-z]sin|sinx|cosx|tanx/.test(eq)) warn("명령어 붙여 씀")
  if (eq.includes(" over ") && !/\}\s*over\s*\{/.test(eq)) warn("over 양쪽 중괄호")
  if (eq.includes("overline")) warn("선분 길이는 bar")
  if (/\bneq\b|<=|>=/.test(eq)) warn("부등호는 != leq geq")
  if (/<\s*-/.test(eq)) warn("<- 는 화살표가 됨, {<}- 로")
  const ends = body.endsWith("`")
  if (next !== "" && !/\s/.test(next)) {
    if (!ends) warn("뒤에 글자가 붙는데 끝 백틱 없음")
    else if (/(?<![A-Za-z])[CEPQRS]`$/.test(body) && !eq.includes("rm") && !body.endsWith("``")) {
      warn("이탤릭 대문자로 끝나면 백틱 둘")
    }
  } else if (ends && !body.startsWith("therefore")) warn("뒤가 띄어쓰기·줄 끝인데 끝 백틱 있음")
  if (prev.endsWith("제") && (next === "항" || next === "사") && !body.startsWith("`")) {
    warn("제n항·제n사분면은 앞에도 백틱")
  }
  for (const m of eq.matchAll(/,/g)) {
    if (
      !eq.slice(0, m.index).trimEnd().endsWith("`") ||
      !eq
        .slice(m.index + 1)
        .trimStart()
        .startsWith("``")
    ) {
      warn("쉼표 앞 백틱 하나, 뒤 둘")
      break
    }
  }
  if (!eq.includes("rm")) {
    if (/(?<![`'])'/.test(eq)) warn("프라임 앞 백틱")
    if (/(?<![A-Za-z])[CEPQRS](?!\s*[`_^])(?![A-Za-z])/.test(eq))
      warn("이탤릭 대문자 C·E·P·Q·R·S 뒤 백틱")
  }
  for (const m of eq.matchAll(/\b(?:sin|cos|tan)\b/g)) {
    const rest = eq
      .slice(m.index + m[0].length)
      .replace(/^\s*\^\s*\{[^}]*\}/, "")
      .trimStart()
    if (rest !== "" && !"`})".includes(rest.charAt(0))) {
      warn("sin·cos·tan과 각 사이 백틱")
      break
    }
  }
  for (const m of eq.matchAll(/(\S+)\s+(?:sin|cos|tan|log|ln)\b/g)) {
    if (needsBacktick(m[1] ?? "")) {
      warn("sin·cos·tan·log 앞 계수 뒤 백틱")
      break
    }
  }
  if (/[0-9)}](?:sin|cos|tan|log|ln)\b/.test(eq)) warn("sin·cos·tan·log 앞 계수 뒤 백틱")
  for (const m of eq.matchAll(/log\s*_\s*\{([^}]*)\}/g)) {
    const base = (m[1] ?? "").trim()
    if (!(base.startsWith("`") && base.endsWith("`"))) warn("로그의 밑 양쪽 백틱")
  }
  for (const m of eq.matchAll(/->/g)) {
    if (
      !eq.slice(0, m.index).trimEnd().endsWith("`") ||
      !eq
        .slice(m.index + 2)
        .trimStart()
        .startsWith("`")
    ) {
      warn("극한 화살표 양쪽 백틱")
      break
    }
  }
  if (/(therefore|because)(?!\s*``)/.test(eq) && body !== "therefore" && body !== "because") {
    warn("therefore·because 뒤 백틱 둘")
  }
  if (eq.includes("cases") && !/#\s*&\s*#/.test(eq)) warn("cases 케이스 사이 빈 줄(# & #)")
  if (count(eq, /\bleft\b/gi) !== count(eq, /\bright\b/gi)) warn("LEFT·RIGHT 짝")
  for (const m of eq.matchAll(/[()[\]]/g)) {
    const need = "([".includes(m[0]) ? "left" : "right"
    if (!new RegExp(`\\b${need}\\s*$`, "i").test(eq.slice(0, m.index))) {
      warn("괄호는 전부 LEFT( RIGHT)·LEFT[ RIGHT]")
      break
    }
  }
  if (
    ARROW.test(eq) &&
    !["RARROW", "LARROW", "LRARROW"].includes(body) &&
    !eq.includes("eqalign")
  ) {
    warn("화살표는 식을 나누어 $A$   $RARROW$   $B$ 꼴로")
  }
  if (/\brm\s+[A-Za-z]+\s*\}?[\s`]*(?:LEFT\b|_\s*\{(?!\s*it\b))/.test(eq)) {
    warn("rm 뒤에 이탤릭이 오면 it으로 되돌린다(rm P it …)")
  }
}

/**
 * Reports manuscript lines that break the 원고 형식 / 수식 띄어쓰기 rules.
 * Run after {@link format}; what remains needs the author's judgment.
 */
export const lint = (text: string): Array<Api.Problem.Warning> => {
  const warnings: Array<Api.Problem.Warning> = []
  text.split("\n").forEach((original, index) => {
    const line = index + 1
    const warn = (rule: string, snippet: string = original.trim()) =>
      warnings.push({ line, rule, text: snippet })
    if (FIGURE_LINE.test(original)) return
    if (original.includes("\t")) warn("탭 문자 대신 공백 4개")
    if (/([①-⑳㉠-㉻]|\((?:가|나|다|라|마|바|사)\))(?!\[반띄쓰\])(?=[^\s,.)\]])/.test(original)) {
      warn("원문자·(가) 뒤에 글자가 붙으면 [반띄쓰]")
    }
    if (/^(코드|정답)\s*:/.test(original)) warn("코드·정답 머리 줄은 쓰지 않는다")
    // numbers that legitimately live outside `$`: figure refs, 문항 번호·배점
    const s = original.replace(/\[그림 \d+\]|<<일러|\d+번|^\d+\.|\[\d+점\]/g, "")
    if (count(s, /\$/g) % 2 === 1) {
      warn("$ 짝이 안 맞음")
      return
    }
    if (
      /\$(?: {0,2}| {4,})\$(?:RARROW|LARROW|LRARROW)\$|\$(?:RARROW|LARROW|LRARROW)\$(?: {0,2}| {4,})\$/.test(
        s,
      )
    ) {
      warn("화살표 수식 양옆은 공백 세 칸")
    }
    const parts = s.split("$")
    for (let k = 1; k < parts.length; k += 2) {
      const eq = parts[k] ?? ""
      checkEquation(eq, (parts[k + 1] ?? "").charAt(0), parts[k - 1] ?? "", (rule) =>
        warn(rule, eq),
      )
      if (/[가-힣]/.test(eq) && !original.includes("<<일러"))
        warn("수식 안 한글에는 <<일러 표시", eq)
    }
    for (let k = 0; k < parts.length; k += 2) {
      const txt = parts[k] ?? ""
      if (/[A-Za-z0-9=<>+]/.test(txt)) warn("수식 밖 영문·숫자", txt.trim())
    }
  })
  return warnings
}
