import type { Role } from "@/generated/prisma/enums";

export interface OidcProfile {
  sub: string;
  email: string;
  name?: string | null;
}

export interface LocalUserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  oidcSubject?: string | null;
}

export interface UserRepository {
  findByOidcSubject(subject: string): Promise<LocalUserRecord | null>;
  findByEmail(email: string): Promise<LocalUserRecord | null>;
  update(
    id: string,
    data: Partial<Pick<LocalUserRecord, "email" | "name" | "oidcSubject">>
  ): Promise<LocalUserRecord>;
  create(data: {
    email: string;
    name: string;
    role: Role;
    oidcSubject: string;
  }): Promise<LocalUserRecord>;
}

function buildDisplayName(profile: OidcProfile) {
  return profile.name?.trim() || profile.email;
}

export async function syncOidcUser(
  repository: UserRepository,
  profile: OidcProfile,
  defaultRole: Role = "USER"
) {
  const matchedBySubject = await repository.findByOidcSubject(profile.sub);
  if (matchedBySubject) {
    return repository.update(matchedBySubject.id, {
      email: profile.email,
      name: buildDisplayName(profile),
      oidcSubject: profile.sub,
    });
  }

  const matchedByEmail = await repository.findByEmail(profile.email);
  if (matchedByEmail) {
    return repository.update(matchedByEmail.id, {
      email: profile.email,
      name: buildDisplayName(profile),
      oidcSubject: profile.sub,
    });
  }

  return repository.create({
    email: profile.email,
    name: buildDisplayName(profile),
    role: defaultRole,
    oidcSubject: profile.sub,
  });
}
