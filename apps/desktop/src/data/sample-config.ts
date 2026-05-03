export const SAMPLE_CONFIG = {
  title: "预算报告",
  summary: {
    sheet_name: "汇总页",
    mode: "table",
    header_row: 1,
    key_column: "科目",
    value_column: "金额（元）",
    prefix: "SUMMARY_",
  },
  sheets: [
    {
      name: "设备费明细",
      sheet_name: "设备费",
      id: "equipment_fee",
      columns: {
        name: "名称",
        spec: "规格",
        unit_price: "单价",
        quantity: "数量",
        amount: "经费",
        reason: "购置理由",
        basis: "测算依据",
      },
      image_columns: ["报价截图"],
    },
  ],
};
