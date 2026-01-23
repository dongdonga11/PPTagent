import { UserStyleProfile } from "../types";

const STORAGE_KEY = 'smart_cms_user_profile';

const DEFAULT_PROFILE: UserStyleProfile = {
    id: 'default',
    name: '默认风格',
    tone: 'Professional',
    forbiddenWords: ['小编', '家人们', 'yyds'],
    preferredEnding: '关注我们，获取更多行业洞察。',
    colorScheme: {
        primary: '#00b96b', // WeChat Green
        secondary: '#f2fcf6'
    }
};

export const getProfile = (): UserStyleProfile => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load profile", e);
    }
    return DEFAULT_PROFILE;
};

export const saveProfile = (profile: UserStyleProfile) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.error("Failed to save profile", e);
    }
};

export const updateProfileField = (field: keyof UserStyleProfile, value: any) => {
    const current = getProfile();
    const updated = { ...current, [field]: value };
    saveProfile(updated);
    return updated;
};
