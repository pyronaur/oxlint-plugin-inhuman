import { type Static, Type } from "typebox";
import { Check, Decode, Parse } from "typebox/value";

declare function decodeBoundary<Schema, Value>(schema: Schema, value: Value): Value;
declare function consume(value: unknown): void;

const Complete = Type.Object({
	name: Type.String(),
	value: Type.Number(),
});
const complete = Decode(Complete, { name: "foo", value: 1 });
console.log(complete.name, complete.value);

const Destructured = Type.Object({
	name: Type.String(),
	value: Type.Number(),
});
const { name, value } = Parse(Destructured, { name: "foo", value: 1 });
console.log(name, value);

const Forwarded = Type.Object({
	name: Type.String(),
	value: Type.Number(),
});
consume(Parse(Forwarded, { name: "foo", value: 1 }));

const Spread = Type.Object({
	name: Type.String(),
	value: Type.Number(),
});
console.log({ ...Parse(Spread, { name: "foo", value: 1 }) });

const Dynamic = Type.Object({
	name: Type.String(),
	value: Type.Number(),
});
const dynamic = Parse(Dynamic, { name: "foo", value: 1 });
const key = "name";
console.log(dynamic[key]);

const Discriminated = Type.Object({
	kind: Type.Literal("foo"),
	value: Type.String(),
});
const discriminated = Parse(Discriminated, { kind: "foo", value: "bar" });
console.log(discriminated.value);

const Predicate = Type.Object({
	checked: Type.String(),
	ignoredLocally: Type.String(),
});
console.log(Check(Predicate, { checked: "foo", ignoredLocally: "bar" }));

const Open = Type.Record(Type.String(), Type.String());
console.log(Parse(Open, { foo: "bar" }));

const Boundary = Type.Object({
	name: Type.String(),
	value: Type.Number(),
});
const boundary = decodeBoundary(Boundary, { name: "foo", value: 1 });
console.log(boundary.name, boundary.value);

const PublicChildSchema = Type.Object({
	publicName: Type.String(),
	publicValue: Type.Number(),
});
const PublicTypeSchema = Type.Object({ child: PublicChildSchema });
Parse(PublicChildSchema, { publicName: "foo", publicValue: 1 });
export type PublicType = Static<typeof PublicTypeSchema>;

Parse(PublicSchema, { publicName: "foo", publicValue: 1 });
export const PublicSchema = Type.Object({
	publicName: Type.String(),
	publicValue: Type.Number(),
});
