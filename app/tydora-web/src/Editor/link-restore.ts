/**
 * IR 模式下链接源码 `[text](url)` 的解析与恢复。
 *
 * 旧实现用 `/^\\[([^\\]]*)\\]\\(([^)]*)\\)$/` 解析，无法处理 linkText 或
 * linkUrl 中包含 `]`、`(`、`)` 的情况；且依赖 convertLinkToSource 时记录的
 * 固定 to，用户编辑后文本长度变化会导致截断、匹配失败，最终源码被当普通
 * 文本保存，`[` `]` 被序列化器转义为 `\\[` `\\]`。
 *
 * 本模块提供：
 * - 带平衡括号/方括道的解析器，从文本开头提取第一个完整 `[text](url)`；
 * - 恢复时从记录的 from 位置向后扫描当前文档内容，不再依赖固定 to。
 */

export interface ParsedLinkSource {
  linkText: string;
  linkUrl: string;
  length: number;
}

/**
 * 从文本开头解析一个 Markdown 行内链接源码 `[text](url)`。
 *
 * 解析规则：
 * - linkText 支持嵌套方括号（按 `[`/`]` 深度匹配）；
 * - linkUrl  支持嵌套圆括号（按 `(`/`)` 深度匹配）；
 * - 不要求文本以链接结尾，后面可跟任意内容，只返回第一个完整链接长度。
 *
 * 无法解析时返回 null。
 */
export function parseMarkdownLinkSource(text: string): ParsedLinkSource | null {
  if (!text || text[0] !== "[") return null;

  // 匹配与开头 [ 对应的 ]
  let bracketDepth = 1;
  let i = 1;
  while (i < text.length && bracketDepth > 0) {
    const ch = text[i];
    if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;
    i++;
  }
  if (bracketDepth !== 0) return null;

  // i 现在指向闭合 ] 之后的字符
  if (text.slice(i - 1, i + 1) !== "](") return null;
  const linkText = text.slice(1, i - 1);

  // 匹配与 URL 开头 ( 对应的 )，支持嵌套
  let parenDepth = 1;
  const urlStart = i + 1;
  let j = urlStart;
  while (j < text.length && parenDepth > 0) {
    const ch = text[j];
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    j++;
  }
  if (parenDepth !== 0) return null;

  const linkUrl = text.slice(urlStart, j - 1);
  return { linkText, linkUrl, length: j };
}

/**
 * 判断 pos 是否落在某个带 link mark 的文本节点内。
 * 用于恢复前检测：若用户编辑期间 input rule 已自动把源码转回 link mark，
 * 则不应再执行删除/插入操作，避免误伤文档。
 */
export function positionHasLinkMark(
  doc: import("prosemirror-model").Node,
  pos: number,
): boolean {
  let found = false;
  doc.nodesBetween(pos, Math.min(pos + 1, doc.content.size), (node) => {
    if (node.isText && node.marks.some((m) => m.type.name === "link")) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}
