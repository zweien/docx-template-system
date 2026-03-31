import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseStructuredPlaceholders } from "./docx-parser";

async function createDocxFile(paragraphs: string[]): Promise<{
  dir: string;
  filePath: string;
}> {
  const zip = new JSZip();
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${paragraphs
          .map(
            (text) => `
              <w:p>
                <w:r><w:t>${text}</w:t></w:r>
              </w:p>
            `
          )
          .join("")}
      </w:body>
    </w:document>`;

  zip.file("word/document.xml", documentXml);

  const dir = await mkdtemp(join(tmpdir(), "docx-parser-test-"));
  const filePath = join(dir, "template.docx");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(filePath, buffer);

  return { dir, filePath };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("docx-parser", () => {
  it("应解析单选选项组", async () => {
    const { dir, filePath } = await createDocxFile([
      "{{选项:性别|single}}",
      "□ 男",
      "□ 女",
    ]);
    tempDirs.push(dir);

    const result = await parseStructuredPlaceholders(filePath);

    expect(result.choiceBlocks).toEqual([
      {
        key: "性别",
        mode: "single",
        options: [
          { value: "男", label: "男", paragraphIndex: 1, markerText: "□" },
          { value: "女", label: "女", paragraphIndex: 2, markerText: "□" },
        ],
      },
    ]);
  });

  it("应解析多组选项并保留普通占位符", async () => {
    const { dir, filePath } = await createDocxFile([
      "{{姓名}}",
      "{{选项:性别|single}}",
      "□ 男",
      "□ 女",
      "{{选项:爱好|multiple}}",
      "□ 篮球",
      "□ 音乐",
    ]);
    tempDirs.push(dir);

    const result = await parseStructuredPlaceholders(filePath);

    expect(result.simplePlaceholders).toContain("姓名");
    expect(result.choiceBlocks.map((item) => item.key)).toEqual(["性别", "爱好"]);
  });

  it("控制行后没有选项时应抛错", async () => {
    const { dir, filePath } = await createDocxFile([
      "{{选项:性别|single}}",
      "{{姓名}}",
    ]);
    tempDirs.push(dir);

    await expect(parseStructuredPlaceholders(filePath)).rejects.toThrow("选项组");
  });

  it("应解析带显式类型控制行的 Word w:sym 内联模板", async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:t>{{选项:单项|single}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>单项</w:t></w:r>
            <w:r><w:t>：</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="0052"/></w:r>
            <w:r><w:t>是</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="00A3"/></w:r>
            <w:r><w:t>否</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>{{选项:多选|multiple}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>多选</w:t></w:r>
            <w:r><w:t>：</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="00A3"/></w:r>
            <w:r><w:t>选项1</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="0052"/></w:r>
            <w:r><w:t>选项2</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="0052"/></w:r>
            <w:r><w:t>选项3</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="00A3"/></w:r>
            <w:r><w:t>选项4</w:t></w:r>
          </w:p>
        </w:body>
      </w:document>`;

    zip.file("word/document.xml", documentXml);
    const dir = await mkdtemp(join(tmpdir(), "docx-parser-inline-test-"));
    tempDirs.push(dir);
    const filePath = join(dir, "inline-choice.docx");
    await writeFile(filePath, await zip.generateAsync({ type: "nodebuffer" }));

    const result = await parseStructuredPlaceholders(filePath);

    expect(result.choiceBlocks).toEqual([
      {
        key: "单项",
        mode: "single",
        options: [
          { value: "是", label: "是", paragraphIndex: 1, markerText: "☑" },
          { value: "否", label: "否", paragraphIndex: 1, markerText: "☐" },
        ],
      },
      {
        key: "多选",
        mode: "multiple",
        options: [
          { value: "选项1", label: "选项1", paragraphIndex: 3, markerText: "☐" },
          { value: "选项2", label: "选项2", paragraphIndex: 3, markerText: "☑" },
          { value: "选项3", label: "选项3", paragraphIndex: 3, markerText: "☑" },
          { value: "选项4", label: "选项4", paragraphIndex: 3, markerText: "☐" },
        ],
      },
    ]);
  });

  it("没有显式类型控制行的 w:sym 段落不应解析为选项组", async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:t>单项</w:t></w:r>
            <w:r><w:t>：</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="0052"/></w:r>
            <w:r><w:t>是</w:t></w:r>
            <w:r><w:sym w:font="Wingdings 2" w:char="00A3"/></w:r>
            <w:r><w:t>否</w:t></w:r>
          </w:p>
        </w:body>
      </w:document>`;

    zip.file("word/document.xml", documentXml);
    const dir = await mkdtemp(join(tmpdir(), "docx-parser-inline-explicit-test-"));
    tempDirs.push(dir);
    const filePath = join(dir, "inline-choice-no-control.docx");
    await writeFile(filePath, await zip.generateAsync({ type: "nodebuffer" }));

    const result = await parseStructuredPlaceholders(filePath);

    expect(result.choiceBlocks).toEqual([]);
  });
});
