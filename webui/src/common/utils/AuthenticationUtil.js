import {postRequest} from './RequestUtil.js';

export class AuthenticationUtil {
    static PASSWORD_KEY = 'quiz_password';

    static async validatePassword(password) {
        try {
            const response = await postRequest("/quizzes/validate-password", {password});
            return response.valid === true;
        } catch (error) {
            console.error("Password validation error:", error);
            throw error;
        }
    }

    static storePassword(password) {
        sessionStorage.setItem(this.PASSWORD_KEY, password);
    }

    static getStoredPassword() {
        return sessionStorage.getItem(this.PASSWORD_KEY);
    }

    static isAuthenticated() {
        return this.getStoredPassword() !== null;
    }

    static clearPassword() {
        sessionStorage.removeItem(this.PASSWORD_KEY);
    }

    static async authenticate(password) {
        const isValid = await this.validatePassword(password);
        if (isValid) this.storePassword(password);
        return isValid;
    }

    static getAuthHeaders() {
        const password = this.getStoredPassword();
        return password ? {'X-Quiz-Password': password} : {};
    }

    static getAuthData() {
        const password = this.getStoredPassword();
        return password ? {password} : {};
    }
}