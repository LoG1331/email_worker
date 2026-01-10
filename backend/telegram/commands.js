import { getConfig } from '../config.js';
import { RegistrationDB, PendingDB } from '../db.js';
import { sendMsg, ensureUserAndCheckPermission } from './utils.js';
import { MENU_KB } from './callbacks.js';

export async function handleTelegramCommand(update, env) {
    const msg = update.message;
    if (!msg?.text || msg.chat.type !== 'private') return;

    const chatId = msg.chat.id.toString();
    const userId = msg.from.id.toString();
    const text = msg.text.trim();
    const reg = new RegistrationDB(env);
    const pendingDB = new PendingDB(env);
    const reply = m => sendMsg(env, chatId, m);
    const config = await getConfig(env);
    const EMAIL_DOMAIN = config?.EMAIL_DOMAIN || '';

    if (text === '/start') {
        return sendMsg(env, chatId, `👋 Chào mừng!\n\n📧 Chọn tùy chọn hoặc dùng:\n• /use abc - Thêm abc@${EMAIL_DOMAIN}`, MENU_KB);
    }

    if (text.startsWith('/use ')) {
        const prefix = text.slice(5).trim().toLowerCase();
        if (prefix.length < 3) return reply('❌ Prefix ≥ 3 ký tự.');
        if (!/^[a-z0-9._-]+$/.test(prefix)) return reply('❌ Chỉ chữ thường, số, . _ -');

        const email = `${prefix}@${EMAIL_DOMAIN}`;
        const owner = await reg.getOwner(email);
        if (owner && owner !== userId) return reply(`❌ ${email} đã được sử dụng.`);
        if (owner === userId) return reply(`⚠️ Đã có ${email} rồi.`);

        const { access } = await ensureUserAndCheckPermission(env, msg.from, prefix);

        if (!access.hasAccess) {
            const result = await pendingDB.create(userId, prefix);
            if (result.success) {
                return reply(`📨 Đã gửi yêu cầu!\n\n📧 Email: ${email}\n\n⏳ Admin sẽ duyệt và bạn sẽ nhận thông báo ngay.`);
            } else {
                return reply(`⏳ Bạn đã có yêu cầu đang chờ duyệt.\n\n💡 Admin sẽ thông báo khi duyệt xong.`);
            }
        }

        await reg.register(userId, email);
        const count = (await reg.getEmailsByOwner(userId)).length;
        return reply(`✅ Đã thêm!\n\n📧 ${email}\n📋 Tổng: ${count}`);
    }

    await reply('❓ Lệnh không hợp lệ. /start để xem menu.');
}
