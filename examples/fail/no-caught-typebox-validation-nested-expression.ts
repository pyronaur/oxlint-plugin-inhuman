import { Type } from "typebox";
import { Decode } from "typebox/value";

const Foo = Type.String();

function parseFoo(value: unknown): Promise<string> {
	try {
		return Promise.resolve(Decode(Foo, value));
	} catch {
		throw new Error("foo");
	}
}

await parseFoo("foo");
