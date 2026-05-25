import { Schema } from "effect";

export const User = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
});

export type User = Schema.Schema.Type<typeof User>;

function toLabel(user: User) {
	return `${user.name}:${user.id}`;
}

export function formatUser(user: User) {
	const label = toLabel(user);
	return label.toUpperCase();
}
