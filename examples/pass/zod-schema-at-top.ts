import { z } from "zod";

export const User = z.object({
	id: z.string(),
	name: z.string(),
});

export type User = z.infer<typeof User>;

function toLabel(user: User) {
	return `${user.name}:${user.id}`;
}

export function formatUser(user: User) {
	const label = toLabel(user);
	return label.toUpperCase();
}