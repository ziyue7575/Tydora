/**
 * parseMarkdownLinkSource 回归测试。
 *
 * 运行方式：node --experimental-strip-types link-restore.test.ts
 * （需在仓库根目录运行以解析 node_modules）
 */
import { parseMarkdownLinkSource } from "./link-restore.ts";

let passed = 0;
let failed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}: 期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function assertObject(
  actual: ReturnType<typeof parseMarkdownLinkSource>,
  expected: { linkText: string; linkUrl: string; length: number } | null,
  label: string,
): void {
  if (
    actual === null && expected === null ||
    actual && expected &&
      actual.linkText === expected.linkText &&
      actual.linkUrl === expected.linkUrl &&
      actual.length === expected.length
  ) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

console.log("── parseMarkdownLinkSource：链接源码解析 ──");

// 基本链接
assertObject(
  parseMarkdownLinkSource("[日常工作/2026/09/2026-09-04.md](日常工作/2026/09/2026-09-04.md)"),
  { linkText: "日常工作/2026/09/2026-09-04.md", linkUrl: "日常工作/2026/09/2026-09-04.md", length: 56 },
  "用户报告场景：含斜杠的中文路径",
);

// 后面跟额外内容
assertObject(
  parseMarkdownLinkSource("[text](url) 后续文本"),
  { linkText: "text", linkUrl: "url", length: 11 },
  "链接后紧跟空格与普通文本",
);

// linkText 含嵌套方括号
assertObject(
  parseMarkdownLinkSource("[[foo]](bar)"),
  { linkText: "[foo]", linkUrl: "bar", length: 12 },
  "linkText 含嵌套方括号",
);

// linkUrl 含嵌套圆括号
assertObject(
  parseMarkdownLinkSource("[text](https://example.com/path(a))"),
  { linkText: "text", linkUrl: "https://example.com/path(a)", length: 35 },
  "linkUrl 含嵌套圆括号",
);

// linkText 含转义或普通圆括号
assertObject(
  parseMarkdownLinkSource("[text (with parens)](url)"),
  { linkText: "text (with parens)", linkUrl: "url", length: 25 },
  "linkText 含圆括号",
);

// 不完整的链接
assertObject(parseMarkdownLinkSource("[text](url"), null, "缺少右圆括号应返回 null");
assertObject(parseMarkdownLinkSource("[text(url)"), null, "缺少右方括号应返回 null");
assertObject(parseMarkdownLinkSource("普通文本"), null, "非链接文本返回 null");

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
