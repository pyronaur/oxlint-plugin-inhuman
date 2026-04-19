import { Schema } from "effect";

const UserSchema = Schema.Struct({
	id: Schema.String,
});

export const User = UserSchema;