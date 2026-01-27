export type User = {
  id: string;
};

type UserRecord = User & {
  createdAt: string;
};

const records = new Map();

function toRecord(user: User): UserRecord {
  const now = new Date().toISOString();
  const record: UserRecord = { ...user, createdAt: now };
  return record;
}

export function saveUser(user: User) {
  const record = toRecord(user);
  records.set(record.id, record);
  return record;
}
