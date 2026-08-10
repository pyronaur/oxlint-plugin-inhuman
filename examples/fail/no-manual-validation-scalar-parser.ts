function positiveSeconds(value: string): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new TypeError("Expected positive seconds");
	}

	return parsed;
}

function timestamp(value: string): Date {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new TypeError("Expected a timestamp");
	}

	return parsed;
}

console.log(positiveSeconds("5"), timestamp("2025-01-01"));
