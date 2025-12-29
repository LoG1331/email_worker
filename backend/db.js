const JSON_HEADERS = { 'Content-Type': 'application/json' };

class BaseDB {
    constructor(stub) {
        this.stub = stub;
    }

    getStub() {
        return this.stub;
    }

    async fetchJson(path, options = {}) {
        const url = new URL(`https://inbox${path}`);
        if (options.params) {
            Object.entries(options.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
            });
        }

        const res = await this.stub.fetch(url.toString(), {
            method: options.method || 'GET',
            headers: options.headers || JSON_HEADERS,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        return res.json();
    }
}

export class InboxDB extends BaseDB {
    constructor(env) {
        super(env.EMAIL_INBOX.get(env.EMAIL_INBOX.idFromName('all@inbox')));
    }

    async save(emailData) {
        const result = await this.fetchJson('/inbox', { method: 'POST', body: emailData });
        console.log(`✅ Saved to central inbox - ID: ${result.id}`);
        return result.id;
    }

    async getAll(limit = 100, offset = 0) {
        return this.fetchJson('/inbox', { params: { limit, offset } });
    }

    async getByAddress(toEmail, limit = 10) {
        const result = await this.fetchJson('/inbox', { params: { email_to: toEmail, limit } });
        return result.emails || [];
    }

    async getByRecipients(emailAddresses, limit = 100, offset = 0) {
        return this.fetchJson('/inbox/by-recipients', {
            method: 'POST',
            body: { emailAddresses, limit, offset }
        });
    }
}

export class RegistrationDB extends BaseDB {
    constructor(env) {
        super(env.REGISTRATION_STORE.get(env.REGISTRATION_STORE.idFromName('_registry')));
    }

    async getOwner(email) {
        const result = await this.fetchJson('/owner', { params: { email } });
        return result.owner;
    }

    async getEmailsByOwner(userId) {
        const result = await this.fetchJson('/emails-by-owner', { params: { owner: userId } });
        return result.emails || [];
    }

    async register(userId, email) {
        return this.fetchJson('/register', { method: 'POST', body: { email, owner: userId } });
    }

    async unregister(email) {
        return this.stub.fetch(new URL(`https://inbox/unregister?email=${encodeURIComponent(email)}`).toString(), { method: 'DELETE' });
    }
}

export class ServiceDB extends BaseDB {
    constructor(env) {
        super(env.SERVICE_STORE.get(env.SERVICE_STORE.idFromName('_services')));
    }

    async recordService(email, serviceDomain) {
        return this.fetchJson('/service', { method: 'POST', body: { email, serviceDomain } });
    }

    async getServicesByEmail(email) {
        const result = await this.fetchJson('/services-by-email', { params: { email } });
        return result.services || [];
    }

    async getEmailsByService(serviceDomain) {
        const result = await this.fetchJson('/emails-by-service', { params: { service: serviceDomain } });
        return result.emails || [];
    }

    async getAllServices() {
        const result = await this.fetchJson('/all-services');
        return result.services || [];
    }

    async deleteService(serviceDomain) {
        return this.stub.fetch(new URL(`https://inbox/service?service_domain=${encodeURIComponent(serviceDomain)}`).toString(), { method: 'DELETE' });
    }

    async deleteEmailFromService(email, serviceDomain) {
        return this.stub.fetch(new URL(`https://inbox/service-email?email=${encodeURIComponent(email)}&service_domain=${encodeURIComponent(serviceDomain)}`).toString(), { method: 'DELETE' });
    }
}

export class UserDB extends BaseDB {
    constructor(env) {
        super(env.USER_STORE.get(env.USER_STORE.idFromName('_users')));
    }

    async upsertUser(userId, firstName, lastName, username) {
        return this.fetchJson('/upsert', { method: 'POST', body: { userId, firstName, lastName, username } });
    }

    async getUser(userId) {
        const result = await this.fetchJson('/get', { params: { user_id: userId } });
        return result.user;
    }

    async getAllUsers() {
        const result = await this.fetchJson('/all');
        return result.users || [];
    }
}

export class PermissionDB extends BaseDB {
    constructor(env) {
        super(env.PERMISSION_STORE.get(env.PERMISSION_STORE.idFromName('_permissions')));
    }

    async grant(userId, type, target, grantedBy) {
        return this.fetchJson('/grant', { method: 'POST', body: { userId, type, target, grantedBy } });
    }

    async revoke(userId, type, target) {
        return this.stub.fetch(new URL(`https://inbox/revoke?user_id=${userId}&type=${type}&target=${target || ''}`).toString(), { method: 'DELETE' });
    }

    async checkAccess(userId, email) {
        return this.fetchJson('/check', { params: { user_id: userId, email: email || '' } });
    }

    async getUserPermissions(userId) {
        const result = await this.fetchJson('/user', { params: { user_id: userId } });
        return result.permissions || [];
    }

    async getAllPermissions() {
        const result = await this.fetchJson('/all');
        return result.permissions || [];
    }
}

export class PendingDB extends BaseDB {
    constructor(env) {
        super(env.PENDING_STORE.get(env.PENDING_STORE.idFromName('_pending')));
    }

    async create(userId, email) {
        return this.fetchJson('/create', { method: 'POST', body: { userId, email } });
    }

    async resolve(id, status, resolvedBy) {
        return this.fetchJson('/resolve', { method: 'POST', body: { id, status, resolvedBy } });
    }

    async getPending() {
        const result = await this.fetchJson('/pending');
        return result.requests || [];
    }

    async getAll() {
        const result = await this.fetchJson('/all');
        return result.requests || [];
    }
}

export class GroupDB extends BaseDB {
    constructor(env) {
        super(env.EMAIL_GROUP_STORE.get(env.EMAIL_GROUP_STORE.idFromName('_groups')));
    }

    async createGroup(name, color) {
        return this.fetchJson('/groups', { method: 'POST', body: { name, color } });
    }

    async getAllGroups() {
        const result = await this.fetchJson('/groups');
        return result.groups || [];
    }

    async updateGroup(groupId, name, color) {
        return this.fetchJson(`/groups/${groupId}`, { method: 'PUT', body: { name, color } });
    }

    async deleteGroup(groupId) {
        return this.stub.fetch(new URL(`https://inbox/groups/${groupId}`).toString(), { method: 'DELETE' });
    }

    async addEmailToGroup(groupId, emailAddress) {
        return this.fetchJson(`/groups/${groupId}/emails`, { method: 'POST', body: { emailAddress } });
    }

    async removeEmailFromGroup(groupId, emailAddress) {
        return this.stub.fetch(new URL(`https://inbox/groups/${groupId}/emails/${encodeURIComponent(emailAddress)}`).toString(), { method: 'DELETE' });
    }

    async getEmailsInGroup(groupId, limit = 100, offset = 0) {
        return this.fetchJson(`/groups/${groupId}/emails`, { params: { limit, offset } });
    }

    async getGroupsForEmail(emailAddress) {
        const result = await this.fetchJson(`/emails/${encodeURIComponent(emailAddress)}/groups`);
        return result.groups || [];
    }
}
