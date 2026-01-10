import { RegistrationDB, ServiceDB, PendingDB } from '../db.js';
import { generateRandomEmail } from '../utils/index.js';
import { editMsg, answerCb, ensureUserAndCheckPermission } from './utils.js';

export const MENU_KB = [
    [{ text: '📧 Tạo email', callback_data: 'create' }, { text: '📋 Email', callback_data: 'myemail' }],
    [{ text: '📊 Dịch vụ', callback_data: 'services' }, { text: '🗑 Xóa tất cả', callback_data: 'removeall' }]
];
export const BACK = [{ text: '⬅️ Menu', callback_data: 'menu' }];

export async function handleCallbackQuery(update, env) {
    const q = update.callback_query;
    if (!q) return;

    answerCb(env, q.id);

    const chatId = q.message.chat.id.toString();
    const userId = q.from.id.toString();
    const msgId = q.message.message_id;
    const [action, param] = q.data.split(':');

    const reg = new RegistrationDB(env);
    const svc = new ServiceDB(env);
    const pendingDB = new PendingDB(env);
    const getEmails = () => reg.getEmailsByOwner(userId);
    const edit = (text, kb) => editMsg(env, chatId, msgId, text, kb);

    const handlers = {
        async menu() {
            await edit('👋 Chào mừng đến Email Bot!\n\n📧 Chọn một tùy chọn:', MENU_KB);
        },

        async create() {
            const { access } = await ensureUserAndCheckPermission(env, q.from);

            if (!access.hasAccess) {
                const email = await generateRandomEmail(env);
                const prefix = email.split('@')[0];

                const result = await pendingDB.create(userId, prefix);

                if (result.success) {
                    return edit(
                        `📨 Đã gửi yêu cầu!\n\n📧 Email: ${email}\n\n⏳ Admin sẽ duyệt và bạn sẽ nhận thông báo ngay khi được cấp quyền.\n\n💡 Bạn có thể tiếp tục sử dụng bot bình thường.`,
                        [
                            [{ text: '📧 Tạo thêm', callback_data: 'create' }],
                            BACK
                        ]
                    );
                } else {
                    return edit(
                        `⏳ Bạn đã có yêu cầu đang chờ duyệt.\n\n💡 Admin sẽ thông báo khi duyệt xong.`,
                        [BACK]
                    );
                }
            }

            const email = await generateRandomEmail(env);
            const owner = await reg.getOwner(email);
            if (owner && owner !== userId) {
                return edit('❌ Email đã được sử dụng. Thử lại.', [BACK]);
            }
            await reg.register(userId, email);
            const count = (await getEmails()).length;
            await edit(`✅ Đã tạo!\n\n📧 ${email}\n📋 Tổng: ${count}`, [
                [{ text: '📋 Copy', copy_text: { text: email } }],
                BACK
            ]);
        },

        async myemail() {
            const emails = await getEmails();
            if (!emails.length) {
                return edit('❌ Chưa có email.', [
                    [{ text: '📧 Tạo email', callback_data: 'create' }], BACK
                ]);
            }
            const kb = emails.map(e => [{ text: `📧 ${e}`, callback_data: `email_detail:${e}` }]);
            kb.push(BACK);
            await edit(`📧 Email (${emails.length}):`, kb);
        },

        async email_detail() {
            const email = param;
            const services = await svc.getServicesByEmail(email);
            let text = `📧 ${email}\n`;
            text += services.length
                ? `\n📊 Dịch vụ (${services.length}):\n` + services.map((s, i) => `  ${i + 1}. ${s.service} (${s.emailCount})`).join('\n')
                : '\n📭 Chưa có dịch vụ.';
            await edit(text, [
                [{ text: '📋 Copy', copy_text: { text: email } }],
                [{ text: '🗑 Xóa', callback_data: `remove:${email}` }],
                [{ text: '⬅️ Danh sách', callback_data: 'myemail' }]
            ]);
        },

        async remove() {
            await reg.unregister(param);
            const count = (await getEmails()).length;
            await edit(`✅ Đã xóa ${param}\n📋 Còn: ${count}`, [BACK]);
        },

        async services() {
            const emails = await getEmails();
            if (!emails.length) return edit('❌ Chưa có email.', [BACK]);

            const allServices = await Promise.all(emails.map(e => svc.getServicesByEmail(e)));

            const map = new Map();
            emails.forEach((email, i) => {
                for (const s of allServices[i]) {
                    if (!map.has(s.service)) map.set(s.service, { count: 0, emails: [] });
                    const entry = map.get(s.service);
                    entry.count += s.emailCount;
                    entry.emails.push(email);
                }
            });

            if (!map.size) return edit('📭 Chưa có dịch vụ.', [BACK]);

            const kb = [...map.entries()].map(([s, d]) =>
                [{ text: `🏢 ${s} (${d.count})`, callback_data: `service_detail:${s}` }]
            );
            kb.push(BACK);
            await edit(`📊 Dịch vụ (${map.size}):`, kb);
        },

        async service_detail() {
            const service = param;
            const emails = await getEmails();
            const allServices = await Promise.all(emails.map(e => svc.getServicesByEmail(e)));

            let text = `🏢 ${service}\n\n📧 Emails:\n`;
            let total = 0;
            emails.forEach((email, i) => {
                const match = allServices[i].find(s => s.service === service);
                if (match) {
                    text += `  • ${email} (${match.emailCount})\n`;
                    total += match.emailCount;
                }
            });
            text += `\n📬 Tổng: ${total}`;
            await edit(text, [[{ text: '⬅️ Dịch vụ', callback_data: 'services' }]]);
        },

        async removeall() {
            const emails = await getEmails();
            if (!emails.length) return edit('❌ Không có email.', [BACK]);
            await edit(`⚠️ Xóa TẤT CẢ ${emails.length} email?`, [
                [{ text: '✅ Xác nhận', callback_data: 'removeall_confirm' }, { text: '❌ Hủy', callback_data: 'menu' }]
            ]);
        },

        async removeall_confirm() {
            const emails = await getEmails();
            await Promise.all(emails.map(e => reg.unregister(e)));
            await edit(`✅ Đã xóa ${emails.length} email.`, [BACK]);
        }
    };

    await handlers[action]?.();
}
