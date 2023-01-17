/*
 * A list of API error codes
 */
export class ErrorCodes {

    // An API request to an invalid route
    public static readonly requestNotFound = 'request_not_found';

    // A generic server error
    public static readonly serverError = 'server_error';

    // A problem reading file data
    public static readonly fileReadError = 'file_read_error';

    // A problem making an HTTP request to the Authorization Server
    public static readonly httpRequestError = 'http_request_error';

    // A generic 401 error returned to clients who send incorrect data
    public static readonly accessDeniedError = 'access_denied';

    // No origin header was supplied
    public static readonly missingWebOrigin = 'missing_web_origin';

    // An untrusted browser origin called the API
    public static readonly untrustedWebOrigin = 'untrusted_web_origin';

    // An error to indicate a cookie not found, which could possibly be a browser issue
    public static readonly invalidStateError = 'invalid_state';

    // An error to indicate a cookie not found, which could possibly be a browser issue
    public static readonly cookieNotFoundError = 'cookie_not_found';

    // An error to indicate a cookie could not be decrypted, if for example it was truncated
    public static readonly cookieDecryptionError = 'cookie_decryption_error';

    // An error to indicate that the request header was missing
    public static readonly missingAntiForgeryTokenError = 'missing_csrf_token';

    // An error to indicate that the request header and secure cookie do not match
    public static readonly mismatchedAntiForgeryTokenError = 'mismatched_csrf_token';

    // An error to indicate that a required form field was not found
    public static readonly formFieldNotFoundError = 'form_field_not_found';

    // Occurs when the refresh token is expired during a refresh token grant request
    public static readonly invalidGrantError = 'invalid_grant';

    // An explicit session expiry error code that is rethrown when invalid_grant occurs
    public static readonly sessionExpiredError = 'session_expired';
}
