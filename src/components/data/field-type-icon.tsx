"use client";

import {
  Type,
  Hash,
  Calendar,
  ChevronDown,
  ListChecks,
  Mail,
  Phone,
  Paperclip,
  Link2,
  Table2,
  Globe,
  CheckSquare,
  Clock,
  UserCircle,
  Calculator,
  Search,
  BarChart3,
  FileText,
  Star,
  DollarSign,
  Percent,
  Timer,
} from "lucide-react";
import { FieldType } from "@/generated/prisma/enums";

const ICON_MAP: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  [FieldType.TEXT]: Type,
  [FieldType.NUMBER]: Hash,
  [FieldType.DATE]: Calendar,
  [FieldType.SELECT]: ChevronDown,
  [FieldType.MULTISELECT]: ListChecks,
  [FieldType.EMAIL]: Mail,
  [FieldType.PHONE]: Phone,
  [FieldType.FILE]: Paperclip,
  [FieldType.RELATION]: Link2,
  [FieldType.RELATION_SUBTABLE]: Table2,
  [FieldType.URL]: Globe,
  [FieldType.BOOLEAN]: CheckSquare,
  [FieldType.AUTO_NUMBER]: Hash,
  [FieldType.SYSTEM_TIMESTAMP]: Clock,
  [FieldType.SYSTEM_USER]: UserCircle,
  [FieldType.FORMULA]: Calculator,
  [FieldType.COUNT]: Calculator,
  [FieldType.LOOKUP]: Search,
  [FieldType.ROLLUP]: BarChart3,
  [FieldType.RICH_TEXT]: FileText,
  [FieldType.RATING]: Star,
  [FieldType.CURRENCY]: DollarSign,
  [FieldType.PERCENTAGE]: Percent,
  [FieldType.DURATION]: Timer,
};

const COMPUTED_TYPES = new Set<FieldType>([
  FieldType.FORMULA,
  FieldType.COUNT,
  FieldType.LOOKUP,
  FieldType.ROLLUP,
]);

export function FieldTypeIcon({
  type,
  className = "h-3.5 w-3.5 text-muted-foreground",
}: {
  type: FieldType;
  className?: string;
}) {
  const Icon = ICON_MAP[type];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function isComputedFieldType(type: FieldType): boolean {
  return COMPUTED_TYPES.has(type);
}
