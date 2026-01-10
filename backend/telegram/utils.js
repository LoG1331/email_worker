import { getConfig } from '../config.js';
import { UserDB, PermissionDB } from '../db.js';
import { convert } from 'html-to-text';

const MAX_LEN = 4000;

// Helper to get API URL from env (async)
export const getAPI = async (env) => {
    const config = await getConfig(env);
    const token = config?.BOT_TOKEN || '';
    return `https://api.telegram.org/bot${token}`;
};

export const tgFetch = async (env, method, body) => {
    const apiUrl = await getAPI(env);
    return fetch(`${apiUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).catch(console.error);
};

export const sanitizeHtml = html =>
    html
        ? convert(html, {
            wordwrap: false,
            preserveNewlines: true,
            selectors: [
                { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
                { selector: 'img', format: 'skip' },
                { selector: 'table', format: 'dataTable' },
                { selector: 'h1', options: { uppercase: false } },
                { selector: 'h2', options: { uppercase: false } },
                { selector: 'h3', options: { uppercase: false } },
            ]
        }).replace(/\n{2,}/g, '\n').trim()
        : '';

export const splitChunks = (text, max) => {
    const chunks = [];
    let cur = '';
    for (const line of text.split('\n')) {
        if (cur.length + line.length + 1 > max) {
            if (cur) chunks.push(cur.trim());
            cur = line;
        } else cur += (cur ? '\n' : '') + line;
    }
    if (cur) chunks.push(cur.trim());
    return chunks;
};

export const sendMsg = async (env, chatId, text, keyboard) => {
    return tgFetch(env, 'sendMessage', {
        chat_id: chatId, text, disable_web_page_preview: true,
        ...(keyboard && { reply_markup: { inline_keyboard: keyboard } })
    });
};

export const editMsg = async (env, chatId, msgId, text, keyboard) => {
    return tgFetch(env, 'editMessageText', {
        chat_id: chatId, message_id: msgId, text, disable_web_page_preview: true,
        ...(keyboard && { reply_markup: { inline_keyboard: keyboard } })
    });
};

export const answerCb = async (env, id) => tgFetch(env, 'answerCallbackQuery', { callback_query_id: id });

export async function sendToTelegram(env, chatId, text) {
    const clean = sanitizeHtml(text);
    if (!clean) return;
    for (const chunk of splitChunks(clean, MAX_LEN)) {
        if (chunk) await sendMsg(env, chatId, chunk);
    }
}

export const sendMessageWithKeyboard = sendMsg;

export async function ensureUserAndCheckPermission(env, from, emailPrefix = null) {
    const userDB = new UserDB(env);
    const permissionDB = new PermissionDB(env);
    const userId = from.id.toString();
    await userDB.upsertUser(userId, from.first_name, from.last_name, from.username);
    const access = await permissionDB.checkAccess(userId, emailPrefix);
    return { userId, access };
}
