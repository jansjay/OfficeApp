import {CookieSerializeOptions} from 'cookie';
import crypto from 'crypto';
import {Request, Response} from 'express';
import {ApiConfiguration} from '../configuration/apiConfiguration';
import {CookieEncrypter} from './cookieEncrypter';

const STATE_COOKIE   = 'state';
const ACCESS_COOKIE  = 'at';
const REFRESH_COOKIE = 'rt';
const ID_COOKIE      = 'id';
const CSRF_COOKIE    = 'csrf';

/*
 * A class to deal with cookie specific responsibilities
 */
export class CookieProcessor {

    private readonly _configuration: ApiConfiguration;

    public constructor(configuration: ApiConfiguration) {
        this._configuration = configuration;
    }

    /*
     * Write a same site state cookie when a login starts
     */
    public writeStateCookie(data: any, response: Response): void {

        const cookieName = this._getCookieName(STATE_COOKIE);

        const encryptedData = CookieEncrypter.encryptCookie(
            cookieName,
            JSON.stringify(data),
            this._configuration.cookieEncryptionKey);

        response.cookie(cookieName, encryptedData, this._getCookieOptions(STATE_COOKIE));
    }

    /*
     * Read the state cookie when a login ends
     */
    public readStateCookie(request: Request): any {

        const cookieName = this._getCookieName(STATE_COOKIE);
        const encryptedData = request.cookies[cookieName];

        if (encryptedData) {

            const serialized = CookieEncrypter.decryptCookie(
                cookieName,
                encryptedData,
                this._configuration.cookieEncryptionKey);

            return JSON.parse(serialized);
        }

        return null;
    }

    /*
     * Generate a field used to protect cookies on data changing requests from the SPA
     */
    public generateAntiForgeryValue(): string {
        return crypto.randomBytes(32).toString('base64');
    }

    /*
     * Write a same site cookie containing the refresh token
     */
    public writeRefreshCookie(refreshToken: string, response: Response): void {

        const cookieName = this._getCookieName(REFRESH_COOKIE);

        const encryptedData = CookieEncrypter.encryptCookie(
            cookieName,
            refreshToken,
            this._configuration.cookieEncryptionKey);

        response.cookie(cookieName, encryptedData, this._getCookieOptions(REFRESH_COOKIE));
    }

    /*
     * Read the refresh token from the cookie
     */
    public readRefreshCookie(request: Request): string | null {

        const cookieName = this._getCookieName(REFRESH_COOKIE);
        const encryptedData = request.cookies[cookieName];

        if (encryptedData) {

            return CookieEncrypter.decryptCookie(
                cookieName,
                encryptedData,
                this._configuration.cookieEncryptionKey);
        }

        return null;
    }

    /*
     * Write a same site cookie containing the access token
     */
    public writeAccessCookie(accessToken: string, response: Response): void {

        const cookieName = this._getCookieName(ACCESS_COOKIE);

        const encryptedData = CookieEncrypter.encryptCookie(
            cookieName,
            accessToken,
            this._configuration.cookieEncryptionKey);

        response.cookie(cookieName, encryptedData, this._getCookieOptions(ACCESS_COOKIE));
    }

    /*
     * Read the access token from the cookie
     */
    public readAccessCookie(request: Request): string | null {

        const cookieName = this._getCookieName(ACCESS_COOKIE);
        const encryptedData = request.cookies[cookieName];

        if (encryptedData) {

            return CookieEncrypter.decryptCookie(
                cookieName,
                encryptedData,
                this._configuration.cookieEncryptionKey);
        }

        return null;
    }

    /*
     * Write a same site cookie containing the id token, in case needed for logout
     */
    public writeIdCookie(idToken: string, response: Response): void {

        const cookieName = this._getCookieName(ID_COOKIE);
        console.log('writeIdCookie: ' + idToken);
        const encryptedData = CookieEncrypter.encryptCookie(
            cookieName,
            idToken,
            this._configuration.cookieEncryptionKey);

        response.cookie(cookieName, encryptedData, this._getCookieOptions(ID_COOKIE));
    }

    /*
     * Read the id cookie if needed for logout
     */
    public readIdCookie(request: Request): string | null {

        const cookieName = this._getCookieName(ID_COOKIE);
        const encryptedData = request.cookies[cookieName];
        console.log('readIdCookie: ' + encryptedData);
        if (encryptedData) {

            return CookieEncrypter.decryptCookie(
                cookieName,
                encryptedData,
                this._configuration.cookieEncryptionKey);
        }

        return null;
    }

    /*
     * Write a cookie to make it harder for malicious code to post bogus forms to our token refresh endpoint
     */
    public writeAntiForgeryCookie(response: Response, csrfValue: string): void {

        const cookieName = this._getCookieName(CSRF_COOKIE);

        const encryptedData = CookieEncrypter.encryptCookie(
            cookieName,
            csrfValue,
            this._configuration.cookieEncryptionKey);

        response.cookie(cookieName, encryptedData, this._getCookieOptions(CSRF_COOKIE));
    }

    /*
     * We also derive the request header value from this class
     */
    public getAntiForgeryRequestHeaderName(): string {

        const cookieName = this._getCookieName(CSRF_COOKIE);
        return `x-${cookieName}`;
    }

    /*
     * Read the anti forgery value from the cookie
     */
    public readAntiForgeryCookie(request: Request): string | null {

        const cookieName = this._getCookieName(CSRF_COOKIE);
        const encryptedData = request.cookies[cookieName];

        if (encryptedData) {

            return CookieEncrypter.decryptCookie(
                cookieName,
                encryptedData,
                this._configuration.cookieEncryptionKey);
        }

        return null;
    }

    /*
     * Clear the temporary state cookie used during login
     */
    public clearStateCookie(response: Response): void {
        response.cookie(this._getCookieName(STATE_COOKIE), '', this._getExpireCookieOptions(STATE_COOKIE));
    }

    /*
     * Clear all cookies when the user session expires
     */
    public clearAll(response: Response): void {

        response.cookie(this._getCookieName(REFRESH_COOKIE), '', this._getExpireCookieOptions(REFRESH_COOKIE));
        response.cookie(this._getCookieName(ACCESS_COOKIE),  '', this._getExpireCookieOptions(ACCESS_COOKIE));
        response.cookie(this._getCookieName(ID_COOKIE),      '', this._getExpireCookieOptions(ID_COOKIE));
        response.cookie(this._getCookieName(CSRF_COOKIE),    '', this._getExpireCookieOptions(CSRF_COOKIE));
    }

    /*
     * Return a cookie of the form 'mycompany-auth-officeappspa'
     */
    private _getCookieName(type: string) {
        return `${this._configuration.cookiePrefix}-${type}`;
    }

    /*
     * All cookies use largely identical options
     */
    private _getCookieOptions(type: string): CookieSerializeOptions {

        const isOAuthOnlyCookie = (type === STATE_COOKIE || type === REFRESH_COOKIE);//TODO || type === ID_COOKIE);
        return {

            // The cookie cannot be read by Javascript code
            httpOnly: true,

            // The cookie can only be sent over an HTTPS connection
            secure: true,

            // The cookie written is only used (by default) in the API domain
            domain: this._configuration.cookieDomain,

            // OAuth only cookies are restricted to OAuth Agent paths
            path: isOAuthOnlyCookie ? '/oauth-agent' : '/',

            // Other domains cannot send the cookie, which reduces cross site request forgery risks
            sameSite: 'strict',
        };
    }

    /*
     * Get options when expiring a cookie
     */
    private _getExpireCookieOptions(type: string): CookieSerializeOptions {

        const options = this._getCookieOptions(type);
        options.expires = new Date(0);
        return options;
    }
}
