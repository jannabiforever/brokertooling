import type * as Api from "@personalos/api"

// Manuscript = the text form shared by 해설 원고 and problem transcripts:
// one line = one paragraph, `$...$` = equation in 한글 수식 편집기 syntax.
// `lint` is a port of the check.py that ships with the haeseol-wongo skill;
// keep rule names identical so the warnings read the same in both places.

/**
 * Normalizes a manuscript before it is linted or built: code fences, CRLF,
 * tabs, and the few equation spellings that have exactly one correct form.
 * Everything else (trailing backticks, LEFT/RIGHT...) depends on context and is
 * only reported by {@link lint}.
 */
export const format = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/^```[^\n]*\n|\n```\s*$/g, "") // models sometimes fence the output
    .replace(/\t/g, "    ")
    .split("\n")
    .map((line) =>
      line
        .split("$")
        .map((piece, i) => (i % 2 === 1 ? fixEquation(piece) : piece))
        .join("$"),
    )
    .join("\n")
    .trimEnd()

const fixEquation = (eq: string): string =>
  eq
    .replace(/overline/g, "bar")
    .replace(/\bneq\b/g, "!=")
    .replace(/<=/g, " leq ")
    .replace(/>=/g, " geq ")
    .replace(/<\s*-/g, "{<}-") // `<-` typesets as an arrow

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

const count = (s: string, re: RegExp): number => Array.from(s.matchAll(re)).length
const isAlnum = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c)

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
    const t = m[1] ?? ""
    const bare = !COMMANDS.has(t) && isAlnum(t.at(-1))
    const closed =
      (t.endsWith("}") || t.endsWith(")")) && !t.startsWith("_{") && !t.startsWith("^{")
    if (bare || closed) {
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
    /\b(?:RARROW|LARROW|LRARROW)\b/.test(eq) &&
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
 * Warnings only: every rule here depends on context the author must judge.
 */
export const lint = (text: string): Array<Api.Problem.Warning> => {
  const warnings: Array<Api.Problem.Warning> = []
  text.split("\n").forEach((original, index) => {
    const line = index + 1
    const warn = (rule: string, snippet: string = original.trim()) =>
      warnings.push({ line, rule, text: snippet })
    if (/^\[(그림|표)( \d+)?:/.test(original)) return // notes for the illustrator, not manuscript
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
