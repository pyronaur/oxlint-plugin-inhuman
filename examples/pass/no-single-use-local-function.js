function normalizeName(name) {
	return name.trim();
}

function hasName(name) {
	return name.length > 0;
}

function keepsName(name) {
	return name.length < 10;
}

export function greet(name) {
	return `${normalizeName(name)}:${normalizeName(name)}:${
		hasName(name) && keepsName(name) ? "yes" : "no"
	}`;
}
