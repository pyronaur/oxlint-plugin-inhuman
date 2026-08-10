import { Type } from "typebox";
import { Decode as decodeFoo } from "typebox/value";

const Foo = Type.String();

function parseFoo(value: unknown): string {
	try {
		return decodeFoo(Foo, value);
	} catch {
		throw new Error("foo");
	}
}

parseFoo("foo");
