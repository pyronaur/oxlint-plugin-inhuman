import { Type } from "typebox";
import { Parse } from "typebox/value";

const Foo = Type.String();

function parseFoo(value: unknown): string {
	try {
		return Parse(Foo, value);
	} catch (cause) {
		throw new Error("foo", { cause });
	}
}

parseFoo("foo");
