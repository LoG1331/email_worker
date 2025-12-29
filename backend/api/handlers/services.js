import { jsonResponse, extractPath } from '../utils.js';

export async function handleServiceRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname } = url;
    const { serviceDB } = storage;

    if (method === 'GET' && pathname.startsWith('/api/services/')) {
        const email = extractPath(pathname, '/api/services/');
        const services = await serviceDB.getServicesByEmail(email);
        return jsonResponse({ email, count: services.length, services });
    }

    if (method === 'GET' && pathname.startsWith('/api/service/')) {
        const serviceDomain = extractPath(pathname, '/api/service/');
        const emails = await serviceDB.getEmailsByService(serviceDomain);
        return jsonResponse({ service: serviceDomain, count: emails.length, emails });
    }

    if (method === 'GET' && pathname === '/api/all-services') {
        const services = await serviceDB.getAllServices();
        return jsonResponse({ count: services.length, services });
    }

    if (method === 'DELETE' && pathname.startsWith('/api/service/')) {
        const pathParts = pathname.split('/');
        const serviceDomain = decodeURIComponent(pathParts[3]);

        if (!serviceDomain) {
            return jsonResponse({ error: 'Service domain required' }, 400);
        }

        // Check if this is deleting an email from service
        if (pathParts.length === 6 && pathParts[4] === 'email') {
            const email = decodeURIComponent(pathParts[5]);
            await serviceDB.deleteEmailFromService(email, serviceDomain);
            return jsonResponse({ success: true, message: 'Email removed from service' });
        }

        // Delete entire service
        await serviceDB.deleteService(serviceDomain);
        return jsonResponse({ success: true, message: 'Service deleted' });
    }

    return null;
}
