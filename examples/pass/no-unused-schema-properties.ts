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

const Aliased = Type.Object({
	selected: Type.Object({
		name: Type.String(),
		value: Type.Number(),
	}),
});
const aliased = Parse(Aliased, { selected: { name: "foo", value: 1 } });
const selectedAlias = aliased.selected;
const { name: aliasName, value: aliasValue } = selectedAlias;
console.log(aliasName, aliasValue);

const DestructuredAlias = Type.Object({
	selected: Type.Object({
		name: Type.String(),
		value: Type.Number(),
	}),
});
const { selected: destructuredAlias } = Parse(DestructuredAlias, {
	selected: { name: "foo", value: 1 },
});
const nestedAlias = destructuredAlias;
console.log(nestedAlias.name, nestedAlias.value);

const PublicChildSchema = Type.Object({
	publicName: Type.String(),
	publicValue: Type.Number(),
});
const PublicTypeSchema = Type.Object({ child: PublicChildSchema });
Parse(PublicChildSchema, { publicName: "foo", publicValue: 1 });

const IteratorPackages = Type.Array(Type.Object({
	source: Type.String(),
	extensions: Type.Array(Type.String()),
}));
const iteratorPackages = Parse(IteratorPackages, []);
iteratorPackages.flatMap(({ source, extensions }) => [source, ...extensions]);

const ForOfPackages = Type.Array(Type.Object({
	source: Type.String(),
	extensions: Type.Array(Type.String()),
}));
const forOfPackages = Decode(ForOfPackages, []);
for (const { source, extensions } of forOfPackages) {
	console.log(source, extensions);
}

const OpaquePackages = Type.Array(Type.Object({
	source: Type.String(),
	extensions: Type.Array(Type.String()),
}));
Parse(OpaquePackages, []).forEach((entry) => consume(entry));

export type PublicType = Static<typeof PublicTypeSchema>;

const IdentityCodec = Type.Decode(Type.Object({
	name: Type.String(),
	value: Type.Number(),
}), (input) => input);
const identity = Decode(IdentityCodec, { name: "foo", value: 1 });
console.log(identity.name, identity.value);

const NullishCodec = Type.Decode(Type.Array(Type.Object({
	source: Type.String(),
	extensions: Type.Array(Type.String()),
})), (input) => input ?? []);
Decode(NullishCodec, []).forEach(({ source, extensions }) => {
	console.log(source, extensions);
});

const ProjectingCodec = Type.Decode(Type.Object({
	left: Type.String(),
	right: Type.String(),
}), ({ left, right }) => `${left}:${right}`);
console.log(Decode(ProjectingCodec, { left: "foo", right: "bar" }));

declare function externalCodec(input: { name: string; value: number }): string;
const OpaqueCodec = Type.Decode(Type.Object({
	name: Type.String(),
	value: Type.Number(),
}), externalCodec);
console.log(Decode(OpaqueCodec, { name: "foo", value: 1 }));

export type PublicUnsafeContract = { used: string; external: string };
const PublicUnsafe = Type.Unsafe<PublicUnsafeContract>(Type.Object({
	used: Type.String(),
	external: Type.String(),
}));
console.log(Parse(PublicUnsafe, { used: "foo", external: "bar" }).used);

interface LaterExportedUnsafeContract {
	used: string;
	external: string;
}
export { type LaterExportedUnsafeContract };
const LaterPublicUnsafe = Type.Unsafe<LaterExportedUnsafeContract>(Type.Object({
	used: Type.String(),
	external: Type.String(),
}));
console.log(Parse(LaterPublicUnsafe, { used: "foo", external: "bar" }).used);

interface PrivateUnsafeContract {
	name: string;
	value: number;
}
const PrivateUnsafe = Type.Unsafe<PrivateUnsafeContract>(Type.Object({
	name: Type.String(),
	value: Type.Number(),
}));
const privateUnsafe = Parse(PrivateUnsafe, { name: "foo", value: 1 });
console.log(privateUnsafe.name, privateUnsafe.value);

const refinedPredicate = ({ condition: { enabled } }: {
	condition: { enabled: boolean };
}) => enabled;
const refinedMessage = ({ label }: { label: string }) => `invalid ${label}`;
const RefinedConsumption = Type.Refine(Type.Object({
	condition: Type.Object({ enabled: Type.Boolean() }),
	label: Type.String(),
	output: Type.String(),
}), refinedPredicate, refinedMessage);
console.log(Parse(RefinedConsumption, {
	condition: { enabled: true },
	label: "foo",
	output: "bar",
}).output);

Parse(PublicSchema, { publicName: "foo", publicValue: 1 });
export const PublicSchema = Type.Object({
	publicName: Type.String(),
	publicValue: Type.Number(),
});
