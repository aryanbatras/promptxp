import type { Prompt } from "./types";

export interface TemplateVariable {
  name: string;
  value: string;
}

export interface TemplateResult {
  text: string;
  variables: TemplateVariable[];
  stripped: number;
}

/**
 * Deterministic "extract reusable template": replaces project-specific nouns,
 * paths, urls and emails with {{variables}}, leaving your engineering rules intact.
 * No model call, no network, fully reversible by the reader.
 */
export function toTemplate(prompt: Prompt, extraNames: string[] = []): TemplateResult {
  const original = prompt.text;
  let text = original;
  const variables: TemplateVariable[] = [];
  const used = new Set<string>();

  const push = (name: string, value: string) => {
    if (!value || value.length < 2) return;
    if (!used.has(name + value)) {
      used.add(name + value);
      if (!variables.some((variable) => variable.name === name)) variables.push({ name, value });
    }
  };

  const replaceAll = (value: string, token: string) => {
    if (!value) return;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\w/.-])${escaped}(?![\\w/.-])`, "gi");
    if (pattern.test(text)) {
      text = text.replace(pattern, token);
      push(token.replace(/[{}]/g, ""), value);
    }
  };

  const segments = prompt.projectName
    .split(/[-_.\s]+/)
    .filter((part) => part.length >= 4 && !/^(unknown|src|app|main|core|frontend|backend|web)$/i.test(part));

  const projectNames = [
    prompt.projectName,
    prompt.projectName.replace(/[-_]/g, " "),
    prompt.projectName.replace(/[-_]/g, ""),
    ...segments,
    ...segments.map((part) => part.replace(/\b\w/g, (c) => c.toUpperCase())),
    ...extraNames,
  ].filter((name) => name && name.length >= 3 && !/^(unknown|src|app|main)$/i.test(name));

  for (const name of Array.from(new Set(projectNames))) replaceAll(name, "{{project}}");

  if (prompt.projectPath) {
    replaceAll(prompt.projectPath, "{{projectPath}}");
    const parent = prompt.projectPath.split("/").slice(0, -1).join("/");
    replaceAll(parent, "{{workspace}}");
  }

  const urls = Array.from(new Set(original.match(/https?:\/\/[^\s)`"']+/g) ?? []));
  for (const url of urls.slice(0, 8)) {
    replaceAll(url, "{{url}}");
    variables.push({ name: `url_${variables.length}`, value: url });
  }

  const emails = Array.from(new Set(original.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []));
  for (const email of emails.slice(0, 5)) replaceAll(email, "{{email}}");

  text = text.replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "{{date}}");

  const changed = original.length - text.length;
  return {
    text,
    variables: variables.filter((variable) => text.includes(`{{${variable.name}}}`)),
    stripped: Math.max(0, changed),
  };
}
