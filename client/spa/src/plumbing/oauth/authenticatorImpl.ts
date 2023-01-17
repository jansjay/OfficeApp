import axios, {AxiosRequestConfig, Method} from 'axios';
import {Guid} from 'guid-typescript';
import urlparse from 'url-parse';
import {OAuthConfiguration} from '../../configuration/oauthConfiguration';
import {ErrorCodes} from '../errors/errorCodes';
import {ErrorFactory} from '../errors/errorFactory';
import {UIError} from '../errors/uiError';
import {AxiosUtils} from '../utilities/axiosUtils';
import {ConcurrentActionHandler} from '../utilities/concurrentActionHandler';
import {HtmlStorageHelper} from '../utilities/htmlStorageHelper';
import {UrlHelper} from '../utilities/urlHelper';
import {Authenticator} from './authenticator';
import {CredentialSupplier} from './credentialSupplier';
import {EndLoginResponse} from './endLoginResponse';
import {PageLoadResult} from './pageLoadResult';

/*
 * The authenticator implementation
 */
export class AuthenticatorImpl implements Authenticator, CredentialSupplier {

    private readonly _oauthAgentBaseUrl: string;
    private readonly _sessionId: string;
    private readonly _concurrencyHandler: ConcurrentActionHandler;
    private _antiForgeryToken: string | null;

    public constructor(configuration: OAuthConfiguration, sessionId: string) {

        this._oauthAgentBaseUrl = configuration.oauthAgentBaseUrl;
        this._sessionId = sessionId;
        this._concurrencyHandler = new ConcurrentActionHandler();
        this._antiForgeryToken = null;
        this._setupCallbacks();
    }

    /*
     * Trigger the login redirect to the Authorization Server
     */
    public async login(currentLocation: string): Promise<void> {

        try {

            // Call the API to set up the login
            const response = await this._callOAuthAgent('POST', '/login/start', this._antiForgeryToken, null);

            // Store the app location and other state if required
            HtmlStorageHelper.appState = {
                path: currentLocation,
            };

            // Then do the redirect
            location.href = response.authorizationRequestUri;

        } catch (e) {

            throw ErrorFactory.fromLoginOperation(e, ErrorCodes.loginRequestFailed);
        }
    }

    /*
     * Check for and handle login responses when the page loads
     */
    public async handlePageLoad(navigateAction: (path: string) => void): Promise<PageLoadResult> {

        try {
            console.log('1');
            // Send the full URL to the Token Handler API
            const request = {
                url: location.href,
            };
            const endLoginResponse = await this._callOAuthAgent(
                'POST',
                '/login/end',
                this._antiForgeryToken, request) as EndLoginResponse;

            // Store the anti forgery token here, used for data changing API requests
            if (endLoginResponse.antiForgeryToken) {
                this._antiForgeryToken = endLoginResponse.antiForgeryToken;
            }
            console.log('2');

            // If a login was handled then the SPA may need to return to its pre-login location
            if (endLoginResponse.handled) {

                const appState = HtmlStorageHelper.appState;
                console.log('3');
                navigateAction(appState ? appState.path : '/spa');
                HtmlStorageHelper.removeAppState();
            }
            console.log('4');

            // Return a result to the rest of the app
            return {
                isLoggedIn: endLoginResponse.isLoggedIn,
                handled: endLoginResponse.handled
            };

        } catch (e: any) {

            // When this is an OAuth response, ensure that there are no leftover details in the browser
            const urlData = urlparse(location.href, true);
            if (urlData.query && urlData.query.state) {
                navigateAction('/spa');
            }

            // Session expired errors are handled by returning a default result and will lead to re-authentication
            if (this._isSessionExpiredError(e)) {

                return {
                    isLoggedIn: false,
                    handled: false,
                };
            }

            // Rethrow other errors
            throw ErrorFactory.fromLoginOperation(e, ErrorCodes.loginResponseFailed);

        }
    }

    /*
     * Do the logout redirect to clear all cookie and token details
     */
    public async logout(): Promise<void> {

        try {

            const response = await this._callOAuthAgent('POST', '/logout', this._antiForgeryToken, null);
            location.href = response.endSessionRequestUri;

        } catch (e) {

            throw ErrorFactory.fromLogoutOperation(e, ErrorCodes.logoutRequestFailed);

        } finally {

            this._antiForgeryToken = null;
        }
    }

    /*
     * When a logout occurs on another browser tab, move this tab to a logged out state
     */
    public async onLoggedOut(): Promise<void> {
        this._antiForgeryToken = null;
    }

    /*
     * This method is for testing only, so that the Office App SPA can receive expired access token responses
     */
    public async expireAccessToken(): Promise<void> {

        try {

            // Try to rewrite the refresh token within the cookie, using existing cookies as the request credential
            await this._callOAuthAgent('POST', '/expire', this._antiForgeryToken, {type: 'access'});

        } catch (e: any) {

            // Session expired errors are silently ignored
            if (!this._isSessionExpiredError(e)) {
                throw ErrorFactory.fromTestExpiryError(e, 'access');
            }
        }
    }

    /*
     * This method is for testing only, so that the Office App SPA can receive expired refresh token responses
     */
    public async expireRefreshToken(): Promise<void> {

        try {

            // Try to rewrite the access token within the cookie, using the existing cookies as the request credential
            await this._callOAuthAgent('POST', '/expire', this._antiForgeryToken, {type: 'refresh'});

        } catch (e: any) {

            // Session expired errors are silently ignored
            if (!this._isSessionExpiredError(e)) {
                throw ErrorFactory.fromTestExpiryError(e, 'refresh');
            }
        }
    }

    /*
     * Deal with supplying or renewing credentials when calling an API, since the authenticator owns the CSRF token
     */
    public async onCallApi(options: AxiosRequestConfig, isRetry: boolean): Promise<void> {

        // If there is no anti forgery token then the user must sign in
        if (!this._antiForgeryToken) {
            throw ErrorFactory.fromLoginRequired();
        }

        // Send the secure cookie
        options.withCredentials = true;

        // Send the anti forgery token on data changing commands
        if (options.method === 'POST'  ||
            options.method === 'PUT'   ||
            options.method === 'PATCH' ||
            options.method === 'DELETE') {

                options.headers!['x-mycompany-csrf'] = this._antiForgeryToken;
        }

        // If retrying an API call, ask the back end for front end API to rewrite the cookie
        if (isRetry) {
            await this._concurrencyHandler.execute(this._performTokenRefresh);
        }
    }

    /*
     * Do the work of asking the token handler API to refresh the access token stored in the secure cookie
     */
    private async _performTokenRefresh(): Promise<void> {

        try {

            await this._callOAuthAgent('POST', '/refresh', this._antiForgeryToken, null);

        } catch (e: any) {

            if (e.statusCode === 401) {
                throw ErrorFactory.fromLoginRequired();
            }

            throw ErrorFactory.fromTokenRefreshError(e);
        }
    }

    /*
     * A parameterized method for calling the OAuth agent
     */
    private async _callOAuthAgent(
        method: Method,
        operationPath: string,
        antiForgeryToken: string | null,
        requestData: any): Promise<any> {

        const url = UrlHelper.append(this._oauthAgentBaseUrl, operationPath);

        try {
            console.log('_callOAuthAgent 1');
            // Same site cookies are also cross origin so the withCredentials flag is needed
            const options: any = {
                url,
                method,
                headers: {
                    accept: 'application/json',
                },
                withCredentials: true,
                //TODO: https self signed
                //rejectUnauthorized: false
            };
            console.log('_callOAuthAgent 2');
            // Post data unless the payload is empty
            if (requestData) {
                options.data = requestData;
                options.headers['content-type'] = 'application/json';
            }
            console.log('_callOAuthAgent 3');
            // Add the anti forgery token when we have one
            if (antiForgeryToken) {
                options.headers['x-mycompany-csrf'] = antiForgeryToken;
            }
            console.log('_callOAuthAgent 4');
            // Supply headers for the Token Handler API to write to logs
            options.headers['x-mycompany-api-client'] = 'OfficeAppSPA';
            options.headers['x-mycompany-session-id'] = this._sessionId;
            options.headers['x-mycompany-correlation-id'] = Guid.create().toString();
            console.log(options);
            // Make the request and return the response
            const response = await axios.request(options as AxiosRequestConfig);
            console.log('_callOAuthAgent 5');
            if (response.data) {

                AxiosUtils.checkJson(response.data);
                return response.data;
            }

            return null;

        } catch (e) {

            throw ErrorFactory.fromHttpError(e, url, 'OAuth Agent');
        }
    }

    /*
     * When operations fail due to invalid cookies, the OAuth proxy will return a 401 during API calls
     * This could also be caused by a new cookie encryption key or a redeployment of the Authorization Server
     */
    private _isSessionExpiredError(e: any): boolean {

        const uiError = e as UIError;
        return uiError.statusCode === 401;
    }

    /*
     * Plumbing to ensure that the this parameter is available in async callbacks
     */
    private _setupCallbacks(): void {
        this._performTokenRefresh = this._performTokenRefresh.bind(this);
    }
}
