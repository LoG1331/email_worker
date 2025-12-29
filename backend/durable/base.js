export const JSON_HEADERS = { 'Content-Type': 'application/json' };
export const MAX_EMAILS = 50000;

export const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
