import { Type } from "typebox";
import { Parse } from "typebox/value";

const Foo = Type.String();

function parseFoo(value: unknown): string {
	try {
		return Parse(Foo, value);
	} catch {
		throw new Error("foo");
	}
}

parseFoo("foo");
