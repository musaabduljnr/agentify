import React from "react";

/**
 * Parses basic Markdown (bold, italics, links, lists) into safe, formatted React elements.
 * Escapes input text first to prevent XSS injections.
 */
export function formatMarkdownToReact(text: string): React.ReactNode {
  if (!text) return null;

  // 1. Escape HTML to prevent XSS
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Format bold: **text** -> <strong>text</strong>
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // 3. Format italics: *text* -> <em>text</em>
  escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // 4. Format links: [text](url) -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
  escaped = escaped.replace(
    /\[(.*?)\]\((https?:\/\/.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">$1</a>'
  );

  // 5. Format lists line-by-line
  const lines = escaped.split("\n");
  let inList = false;
  const formattedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.substring(2);
      let listLine = `<li>${content}</li>`;
      if (!inList) {
        inList = true;
        listLine = `<ul class="list-disc pl-5 my-2 space-y-1">${listLine}`;
      }
      return listLine;
    } else {
      let prefix = "";
      if (inList) {
        inList = false;
        prefix = "</ul>";
      }
      return prefix + line;
    }
  });

  if (inList) {
    formattedLines.push("</ul>");
  }

  escaped = formattedLines.join("\n");

  // 6. Convert newlines: double newlines become spacing divs, single newlines become <br />
  escaped = escaped.replace(/\n\n/g, '<div class="h-2"></div>');
  escaped = escaped.replace(/\n/g, "<br />");

  return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
}
