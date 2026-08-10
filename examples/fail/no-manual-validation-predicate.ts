type Payload = {
	items: string[];
};

function isPayload(value: unknown): value is Payload {
	return (
		typeof value === "object"
		&& value !== null
		&& "items" in value
		&& Array.isArray(value.items)
	);
}

console.log(isPayload({ items: [] }));
