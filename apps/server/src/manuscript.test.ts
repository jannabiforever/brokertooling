import { readFileSync } from "node:fs"

import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { describe, expect } from "vitest"

import * as Manuscript from "./manuscript.ts"

// The worked example from the haeseol-wongo skill: the style every manuscript
// is checked against, so it must pass clean.
const example = readFileSync(new URL("./manuscript.fixture.txt", import.meta.url), "utf8")

// One or two violations per line; expectations are check.py's output on the
// same text, so this doubles as a port-fidelity test.
const bad = [
  "함수 $f(x)$의 값",
  "점 $rm A$, $rm B$",
  "$x<-1$이면",
  "$overline {rm AB} `=1$ 이고",
  "$\\frac{1}{2}$의",
  "(가)조건에서 $n`$은 자연수",
  "$a _{n}$ 와 x=1",
  "\t$2 sin x$",
  "$lim _{x->0} f LEFT( x RIGHT)$",
  "$log _{2} x$",
  "$a$ $RARROW$ $b$",
  "$cases{ a & b # c & d }$",
  "$A RARROW B$",
  "$rm P LEFT( X RIGHT)$",
  "$LEFT( 1,2 RIGHT)$",
  "정답: 3",
  "$x$$",
  "$f' LEFT( x RIGHT)`$의",
  "$C LEFT( x RIGHT)$",
  "$n이 홀수$",
  "제$n$항과 $a`$ ",
  "$therefore 3$",
  "$a neq b$, $c<=d$",
].join("\n")

describe("Manuscript", () => {
  it.effect("accepts the skill's worked example as is", () =>
    Effect.gen(function* () {
      yield* Effect.void
      expect(Manuscript.lint(example)).toEqual([])
      expect(Manuscript.format(example)).toBe(example.trimEnd())
    }),
  )

  it.effect("reports the same findings as check.py", () =>
    Effect.gen(function* () {
      yield* Effect.void
      const findings = Manuscript.lint(bad).map((w) => [w.line, w.rule, w.text])
      expect(findings).toEqual([
        [1, "뒤에 글자가 붙는데 끝 백틱 없음", "f(x)"],
        [1, "괄호는 전부 LEFT( RIGHT)·LEFT[ RIGHT]", "f(x)"],
        [2, "뒤에 글자가 붙는데 끝 백틱 없음", "rm A"],
        [3, "<- 는 화살표가 됨, {<}- 로", "x<-1"],
        [3, "뒤에 글자가 붙는데 끝 백틱 없음", "x<-1"],
        [4, "선분 길이는 bar", "overline {rm AB} `=1"],
        [5, "LaTeX 역슬래시", "\\frac{1}{2}"],
        [5, "뒤에 글자가 붙는데 끝 백틱 없음", "\\frac{1}{2}"],
        [6, "원문자·(가) 뒤에 글자가 붙으면 [반띄쓰]", "(가)조건에서 $n`$은 자연수"],
        [7, "수식 밖 영문·숫자", "와 x=1"],
        [8, "탭 문자 대신 공백 4개", "$2 sin x$"],
        [8, "sin·cos·tan과 각 사이 백틱", "2 sin x"],
        [8, "sin·cos·tan·log 앞 계수 뒤 백틱", "2 sin x"],
        [9, "극한 화살표 양쪽 백틱", "lim _{x->0} f LEFT( x RIGHT)"],
        [10, "로그의 밑 양쪽 백틱", "log _{2} x"],
        [11, "화살표 수식 양옆은 공백 세 칸", "$a$ $RARROW$ $b$"],
        [12, "cases 케이스 사이 빈 줄(# & #)", "cases{ a & b # c & d }"],
        [13, "화살표는 식을 나누어 $A$   $RARROW$   $B$ 꼴로", "A RARROW B"],
        [14, "rm 뒤에 이탤릭이 오면 it으로 되돌린다(rm P it …)", "rm P LEFT( X RIGHT)"],
        [15, "쉼표 앞 백틱 하나, 뒤 둘", "LEFT( 1,2 RIGHT)"],
        [16, "코드·정답 머리 줄은 쓰지 않는다", "정답: 3"],
        [16, "수식 밖 영문·숫자", "정답: 3"],
        [17, "$ 짝이 안 맞음", "$x$$"],
        [18, "프라임 앞 백틱", "f' LEFT( x RIGHT)`"],
        [19, "이탤릭 대문자 C·E·P·Q·R·S 뒤 백틱", "C LEFT( x RIGHT)"],
        [20, "수식 안 한글에는 <<일러 표시", "n이 홀수"],
        [21, "뒤에 글자가 붙는데 끝 백틱 없음", "n"],
        [21, "제n항·제n사분면은 앞에도 백틱", "n"],
        [21, "뒤가 띄어쓰기·줄 끝인데 끝 백틱 있음", "a`"],
        [22, "therefore·because 뒤 백틱 둘", "therefore 3"],
        [23, "부등호는 != leq geq", "a neq b"],
        [23, "뒤에 글자가 붙는데 끝 백틱 없음", "a neq b"],
        [23, "부등호는 != leq geq", "c<=d"],
      ])
    }),
  )

  it.effect("lets 문항 번호·배점 and figure notes live outside $…$", () =>
    Effect.gen(function* () {
      yield* Effect.void
      expect(Manuscript.lint("12. [3점]\n[그림: y=f(x)의 그래프]\n[표: 2x3]")).toEqual([])
    }),
  )

  it.effect("format fixes only the unambiguous spellings", () =>
    Effect.gen(function* () {
      yield* Effect.void
      expect(Manuscript.format("```text\n$x<-1$\n```\n")).toBe("$x{<}-1$")
      expect(Manuscript.format("$a<=b$ $overline {rm AB}$\r\n\tc")).toBe(
        "$a leq b$ $bar {rm AB}$\n    c",
      )
      expect(Manuscript.format("$a neq b$ x<=y")).toBe("$a != b$ x<=y") // text is left alone
    }),
  )
})
