import { Type } from "typebox";
import { Assert, Decode, Parse } from "typebox/value";

const DirectSchema = Type.Object({
	used: Type.String(),
	ignored: Type.String(),
});
const direct = Decode(DirectSchema, { used: "foo", ignored: "bar" });
console.log(direct.used);

const NestedSchema = Type.Object({
	selected: Type.Object({
		used: Type.String(),
		ignored: Type.String(),
	}),
});
const nested = Parse(NestedSchema, {
	selected: { used: "foo", ignored: "bar" },
});
console.log(nested.selected.used);

const Pair = Type.Tuple([Type.String(), Type.String()]);
const [first] = Parse(Pair, ["foo", "bar"]);
console.log(first);

const Asserted = Type.Object({
	used: Type.String(),
	ignored: Type.String(),
});
const asserted: unknown = { used: "foo", ignored: "bar" };
Assert(Asserted, asserted);
console.log(asserted.used);

declare function decodeBoundary<Schema, Value>(schema: Schema, value: Value): Value;

const BoundarySchema = Type.Object({
	used: Type.String(),
	ignored: Type.String(),
});
const boundary = decodeBoundary(BoundarySchema, {
	used: "foo",
	ignored: "bar",
});
console.log(boundary.used);

const AliasedSchema = Type.Object({
	selected: Type.Object({
		used: Type.String(),
		ignored: Type.String(),
	}),
});
const aliased = Parse(AliasedSchema, {
	selected: { used: "foo", ignored: "bar" },
});
const selectedAlias = aliased.selected;
const nestedAlias = selectedAlias;
console.log(nestedAlias.used);

const DestructuredAliasSchema = Type.Object({
	selected: Type.Object({
		used: Type.String(),
		ignored: Type.String(),
	}),
});
const { selected: destructuredAlias } = Parse(DestructuredAliasSchema, {
	selected: { used: "foo", ignored: "bar" },
});
console.log(destructuredAlias.used);
