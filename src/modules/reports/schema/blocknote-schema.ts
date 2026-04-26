import { BlockNoteSchema } from "@blocknote/core";
import { MermaidBlockSpec } from "@/modules/reports/components/editor/MermaidBlock";
import { TableCaptionBlockSpec } from "@/modules/reports/components/editor/TableCaptionBlock";

export const reportSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    mermaidBlock: MermaidBlockSpec(),
    tableCaption: TableCaptionBlockSpec(),
  },
});
