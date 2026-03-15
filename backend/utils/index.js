import { getConfig } from '../config.js';
import { firstNames, lastNames, midInit } from './names.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randNum = max => Math.floor(Math.random() * max) + 1;

const patterns = [
    (f, l) => `${f}.${l}`,
    (f, l) => `${f}.${midInit[randNum(midInit.length) - 1]}.${l}`,
    (f, l) => `${f}${l}${randNum(999)}`,
    (f) => `${f}${randNum(35) + 1979}`,
    (f, l) => `${f[0]}${l}${randNum(99)}`,
    (f, l) => `${f}_${l}`,
    (f, l) => `${f}-${l}`,
    (f, l) => `${f}${randNum(999)}${l}`,
    (f, l) => `${l}.${f}`,
    (f, l) => `${f}${midInit[randNum(midInit.length) - 1]}${l}`,
    (f, l) => `${f}.${l}${randNum(99)}`,
    (f, l) => `${f}_${l}${randNum(99)}`,
    (f, l) => `${f}${l.slice(0, 3)}${randNum(99)}`,
    (f, l) => `${f.slice(0, 3)}${l}${randNum(999)}`,
    (f, l) => `${l}${f[0]}${randNum(99)}`,
    (f, l) => `${f[0]}${f[1] || 'x'}${l}${randNum(99)}`
];

export const generateRandomEmail = async (env) => {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const username = pick(patterns)(first, last);
    const config = await getConfig(env);
    const EMAIL_DOMAIN = (config?.EMAIL_DOMAIN || '').trim();
    return `${username}@${EMAIL_DOMAIN}`;
};