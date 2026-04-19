import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NAV_COLLAPSED_STORAGE_KEY, useNavigationState } from "./state";

describe("useNavigationState", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("默认 collapsed=false 且 toggle 生效", () => {
    const { result } = renderHook(() => useNavigationState());

    expect(result.current.collapsed).toBe(false);

    act(() => {
      result.current.toggleCollapsed();
    });

    expect(result.current.collapsed).toBe(true);
  });

  it("当 localStorage 初值为 true 时，初始化后 collapsed=true 且不会先写 false", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockReturnValue("true");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useNavigationState());

    await waitFor(() => {
      expect(result.current.collapsed).toBe(true);
    });

    expect(getItemSpy).toHaveBeenCalledWith(NAV_COLLAPSED_STORAGE_KEY);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(NAV_COLLAPSED_STORAGE_KEY, "true");
    expect(setItemSpy).not.toHaveBeenCalledWith(NAV_COLLAPSED_STORAGE_KEY, "false");
  });

  it("toggle 后会写入 localStorage", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useNavigationState());

    act(() => {
      result.current.toggleCollapsed();
    });

    expect(setItemSpy).toHaveBeenCalledWith(NAV_COLLAPSED_STORAGE_KEY, "true");
  });

  it("setMobileOpen 可直接更新移动端打开状态", () => {
    const { result } = renderHook(() => useNavigationState());

    expect(result.current.mobileOpen).toBe(false);

    act(() => {
      result.current.setMobileOpen(true);
    });

    expect(result.current.mobileOpen).toBe(true);

    act(() => {
      result.current.setMobileOpen(false);
    });

    expect(result.current.mobileOpen).toBe(false);
  });
});
