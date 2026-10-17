export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar: string;
  readonly role: string;
}

export const rootUser: User = {
  id: "1",
  name: "ELI Admin",
  email: "admin@ma-no.work",
  avatar: "",
  role: "admin",
};

export const users: readonly User[] = [rootUser] as const;
