import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoicePickerField } from "./choice-picker-field";

describe("choice-picker-field", () => {
  it("单选模式应只保留一个选中值", async () => {
    const onChange = vi.fn();

    render(
      <ChoicePickerField
        mode="single"
        options={[
          { value: "男", label: "男" },
          { value: "女", label: "女" },
        ]}
        value="男"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "男" }));
    const popover = await screen.findByRole("dialog");
    fireEvent.click(within(popover).getByRole("button", { name: "女" }));

    expect(onChange).toHaveBeenCalledWith("女");
  });

  it("多选模式应返回字符串数组", async () => {
    const onChange = vi.fn();

    render(
      <ChoicePickerField
        mode="multiple"
        options={[
          { value: "篮球", label: "篮球" },
          { value: "音乐", label: "音乐" },
        ]}
        value={["篮球"]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "已选择 1 项" }));
    const popover = await screen.findByRole("dialog");
    fireEvent.click(within(popover).getByText("音乐"));

    expect(onChange).toHaveBeenCalledWith(["篮球", "音乐"]);
  });
});
