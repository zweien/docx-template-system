import { describe, expect, test, vi } from "vitest";

import { syncOidcUser } from "@/lib/oidc-user-sync";

describe("syncOidcUser", () => {
  test("命中 oidcSubject 时应更新现有用户", async () => {
    const repository = {
      findByOidcSubject: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "old@example.com",
        name: "Old Name",
        role: "ADMIN",
        oidcSubject: "oidc-sub-1",
      }),
      findByEmail: vi.fn(),
      update: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "new@example.com",
        name: "New Name",
        role: "ADMIN",
        oidcSubject: "oidc-sub-1",
      }),
      create: vi.fn(),
    };

    const user = await syncOidcUser(repository, {
      sub: "oidc-sub-1",
      email: "new@example.com",
      name: "New Name",
    });

    expect(repository.findByOidcSubject).toHaveBeenCalledWith("oidc-sub-1");
    expect(repository.findByEmail).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith("user-1", {
      email: "new@example.com",
      name: "New Name",
      oidcSubject: "oidc-sub-1",
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(user.role).toBe("ADMIN");
  });

  test("未命中 oidcSubject 但命中邮箱时应认领旧账号", async () => {
    const repository = {
      findByOidcSubject: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue({
        id: "user-2",
        email: "owner@example.com",
        name: "Owner",
        role: "ADMIN",
        oidcSubject: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: "user-2",
        email: "owner@example.com",
        name: "Owner",
        role: "ADMIN",
        oidcSubject: "oidc-sub-2",
      }),
      create: vi.fn(),
    };

    const user = await syncOidcUser(repository, {
      sub: "oidc-sub-2",
      email: "owner@example.com",
      name: "Owner",
    });

    expect(repository.findByEmail).toHaveBeenCalledWith("owner@example.com");
    expect(repository.update).toHaveBeenCalledWith("user-2", {
      email: "owner@example.com",
      name: "Owner",
      oidcSubject: "oidc-sub-2",
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(user.oidcSubject).toBe("oidc-sub-2");
  });

  test("首次登录时应创建默认 USER 角色的本地映射", async () => {
    const repository = {
      findByOidcSubject: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: "user-3",
        email: "new-user@example.com",
        name: "new-user@example.com",
        role: "USER",
        oidcSubject: "oidc-sub-3",
      }),
    };

    const user = await syncOidcUser(repository, {
      sub: "oidc-sub-3",
      email: "new-user@example.com",
      name: "",
    });

    expect(repository.create).toHaveBeenCalledWith({
      email: "new-user@example.com",
      name: "new-user@example.com",
      role: "USER",
      oidcSubject: "oidc-sub-3",
    });
    expect(user.role).toBe("USER");
  });

  test("配置了默认角色时应按指定角色创建本地映射", async () => {
    const repository = {
      findByOidcSubject: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: "user-4",
        email: "admin@example.com",
        name: "Admin",
        role: "ADMIN",
        oidcSubject: "oidc-sub-4",
      }),
    };

    const user = await syncOidcUser(
      repository,
      {
        sub: "oidc-sub-4",
        email: "admin@example.com",
        name: "Admin",
      },
      "ADMIN"
    );

    expect(repository.create).toHaveBeenCalledWith({
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      oidcSubject: "oidc-sub-4",
    });
    expect(user.role).toBe("ADMIN");
  });
});
