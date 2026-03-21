function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

export function normalizeDomain(value) {
    const normalized = normalizeText(value);
    if (!normalized || !normalized.includes('.') || normalized.startsWith('.') || normalized.endsWith('.')) {
        return '';
    }

    return normalized;
}

export function normalizeLocalPart(value) {
    const normalized = normalizeText(value);
    if (!normalized || normalized.includes('@') || normalized.startsWith('.')) {
        return '';
    }

    return normalized;
}

export function buildEmailAddress(localPart, domain) {
    const normalizedLocalPart = normalizeLocalPart(localPart);
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedLocalPart || !normalizedDomain) {
        return '';
    }

    return `${normalizedLocalPart}@${normalizedDomain}`;
}

export function parseEmailAddress(value) {
    const normalized = normalizeText(value);
    const atIndex = normalized.indexOf('@');
    if (!normalized || atIndex <= 0 || atIndex === normalized.length - 1) {
        return null;
    }

    const localPart = normalizeLocalPart(normalized.slice(0, atIndex));
    const domain = normalizeDomain(normalized.slice(atIndex + 1));
    if (!localPart || !domain) {
        return null;
    }

    return {
        email: `${localPart}@${domain}`,
        localPart,
        domain
    };
}

export function parseEnvelopeAddress(value) {
    return parseEmailAddress(value);
}

