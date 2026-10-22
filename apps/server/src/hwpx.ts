import { crc32, deflateRawSync } from "node:zlib"

// Minimal OWPML (.hwpx) writer: one section, one style, text runs and equation
// objects. Property blocks are copied from a Hancom-saved single-problem file so
// Hancom opens the result without repair. Layout data (linesegarray, equation
// size) is left out on purpose: Hancom recomputes it on open.

const XML_DECL = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>`
const NS = `xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"`

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }
const escapeXml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c)

// --- package files -----------------------------------------------------------

const VERSION = `${XML_DECL}<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="10" xmlVersion="1.5" application="personalos" appVersion="0.0.0"/>`

const CONTAINER = `${XML_DECL}<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>`

const MANIFEST = `${XML_DECL}<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`

const CONTENT_HPF = `${XML_DECL}<opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>문제</opf:title><opf:language>ko</opf:language></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`

const SETTINGS = `${XML_DECL}<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`

// --- header.xml: fonts, one char/para property, one style ---------------------

const FONTFACES = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"]
  .map(
    (lang) =>
      `<hh:fontface lang="${lang}" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/></hh:fontface>`,
  )
  .join("")

const borderFill = (id: number, fill: string) =>
  `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>${fill}</hh:borderFill>`

// outline numbering referenced by secPr/@outlineShapeIDRef; Hancom's defaults
const PARA_HEADS = [
  ["DIGIT", "^1."],
  ["HANGUL_SYLLABLE", "^2."],
  ["DIGIT", "^3)"],
  ["HANGUL_SYLLABLE", "^4)"],
  ["DIGIT", "(^5)"],
  ["HANGUL_SYLLABLE", "(^6)"],
  ["CIRCLED_DIGIT", "^7"],
]
  .map(
    ([format, text], i) =>
      `<hh:paraHead start="1" level="${i + 1}" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="${format}" charPrIDRef="4294967295" checkable="0">${text}</hh:paraHead>`,
  )
  .join("")

const HEADER = `${XML_DECL}<hh:head ${NS} version="1.5" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList><hh:fontfaces itemCnt="7">${FONTFACES}</hh:fontfaces><hh:borderFills itemCnt="2">${borderFill(1, "")}${borderFill(2, `<hc:fillBrush><hc:winBrush faceColor="none" hatchColor="#999999" alpha="0"/></hc:fillBrush>`)}</hh:borderFills><hh:charProperties itemCnt="1"><hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/></hh:charPr></hh:charProperties><hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties><hh:numberings itemCnt="1"><hh:numbering id="1" start="0">${PARA_HEADS}</hh:numbering></hh:numberings><hh:paraProperties itemCnt="1"><hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/><hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr></hh:paraProperties><hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles></hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption><hh:trackchageConfig flags="56"/></hh:head>`

// --- section0.xml: A4, one column, paragraphs of text + equations ----------------

const SEC_PR = `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`

const equation = (id: number, script: string) =>
  `<hp:equation id="${id}" zOrder="0" numberingType="EQUATION" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" version="Equation Version 60" baseLine="94" textColor="#000000" baseUnit="1000" lineMode="CHAR" font="HYhwpEQ"><hp:sz width="4000" widthRelTo="ABSOLUTE" height="2000" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="56" right="56" top="0" bottom="0"/><hp:shapeComment>수식입니다.</hp:shapeComment><hp:script>${escapeXml(script)}</hp:script></hp:equation>`

/**
 * Inline content of one manuscript line: `$...$` spans become equation objects
 * (script in 한글 수식 편집기 syntax), everything else text.
 */
export const runs = (line: string, nextId: () => number): string =>
  line
    .split("$")
    .map((piece, i) =>
      i % 2 === 1 ? equation(nextId(), piece.trim()) : piece && `<hp:t>${escapeXml(piece)}</hp:t>`,
    )
    .join("")

/**
 * Builds a .hwpx from a manuscript: one line = one paragraph, `$...$` = equation.
 * Same convention as the 해설 원고 text files, so the output drops straight into
 * the existing workflow.
 */
export const fromManuscript = (manuscript: string): Uint8Array => {
  let id = 1
  const nextId = () => id++
  const lines = manuscript
    .replace(/^```[^\n]*\n|\n```\s*$/g, "") // models sometimes fence the output
    .trimEnd()
    .split(/\r?\n/)
  const paragraphs = lines
    .map(
      (line, i) =>
        `<hp:p id="${nextId()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${i === 0 ? `<hp:run charPrIDRef="0">${SEC_PR}</hp:run>` : ""}<hp:run charPrIDRef="0">${runs(line, nextId)}</hp:run></hp:p>`,
    )
    .join("")
  return zip([
    ["mimetype", "application/hwp+zip"],
    ["version.xml", VERSION],
    ["META-INF/container.xml", CONTAINER],
    ["META-INF/manifest.xml", MANIFEST],
    ["Contents/content.hpf", CONTENT_HPF],
    ["Contents/header.xml", HEADER],
    ["Contents/section0.xml", `${XML_DECL}<hs:sec ${NS}>${paragraphs}</hs:sec>`],
    ["settings.xml", SETTINGS],
  ])
}

// --- zip (stdlib only) --------------------------------------------------------

const le = (fields: ReadonlyArray<readonly [size: 2 | 4, value: number]>): Buffer => {
  const buf = Buffer.alloc(fields.reduce((n, [size]) => n + size, 0))
  let pos = 0
  for (const [size, value] of fields) {
    if (size === 2) buf.writeUInt16LE(value, pos)
    else buf.writeUInt32LE(value, pos)
    pos += size
  }
  return buf
}

// ponytail: plain zip32, no zip64 / no data descriptors -- a .hwpx is a few KB.
const zip = (entries: ReadonlyArray<readonly [name: string, content: string]>): Buffer => {
  const locals: Array<Buffer> = []
  const centrals: Array<Buffer> = []
  let offset = 0
  entries.forEach(([name, content], i) => {
    const data = Buffer.from(content, "utf8")
    const stored = i === 0 // OCF rule: mimetype first and uncompressed
    const body = stored ? data : deflateRawSync(data)
    const nameBytes = Buffer.from(name, "utf8")
    // method, flags (utf-8 names), time 00:00, date 1980-01-01, crc, sizes, name length
    const common = [
      [2, 0x0800],
      [2, stored ? 0 : 8],
      [2, 0],
      [2, 0x21],
      [4, crc32(data)],
      [4, body.length],
      [4, data.length],
      [2, nameBytes.length],
    ] as const
    locals.push(le([[4, 0x04034b50], [2, 20], ...common, [2, 0]]), nameBytes, body)
    centrals.push(
      le([
        [4, 0x02014b50],
        [2, 20],
        [2, 20],
        ...common,
        [2, 0],
        [2, 0],
        [2, 0],
        [2, 0],
        [4, 0],
        [4, offset],
      ]),
      nameBytes,
    )
    offset += 30 + nameBytes.length + body.length
  })
  const directory = Buffer.concat(centrals)
  const end = le([
    [4, 0x06054b50],
    [2, 0],
    [2, 0],
    [2, entries.length],
    [2, entries.length],
    [4, directory.length],
    [4, offset],
    [2, 0],
  ])
  return Buffer.concat([...locals, directory, end])
}
