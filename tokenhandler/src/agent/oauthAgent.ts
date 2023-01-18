import base64url from 'base64url';
import axios, { AxiosResponse } from 'axios';
import https from 'https';
import fs from 'fs-extra';
import {Request, Response} from 'express';
import {ApiConfiguration} from '../configuration/apiConfiguration';
import {ErrorUtils} from '../errors/errorUtils';
import {OAuthErrorStatus} from '../errors/oauthErrorStatus';
import {LogEntry} from '../logging/logEntry';
import {HeaderProcessor} from '../utilities/headerProcessor';
import {ResponseWriter} from '../utilities/responseWriter';
import {UrlHelper} from '../utilities/urlHelper';
import {CookieProcessor} from './cookieProcessor';
import {AuthorizationServerClient} from './authorizationServerClient';
import {EndLoginResponse} from './endLoginResponse';

/*
 * The entry point class for the OAuth Agent's logic, which performs an outline of processing
 */
export class OAuthAgent {

    private readonly _apiConfiguration: ApiConfiguration;
    private readonly _authorizationServerClient: AuthorizationServerClient;
    readonly _cookieProcessor: CookieProcessor;

    public constructor(
        apiConfiguration: ApiConfiguration,
        cookieProcessor: CookieProcessor,
        authorizationServerClient: AuthorizationServerClient) {

        this._apiConfiguration = apiConfiguration;
        this._cookieProcessor = cookieProcessor;
        this._authorizationServerClient = authorizationServerClient;
        this._setupCallbacks();
    }

    /*
     * Calculate the authorization redirect URL and write a state cookie
     */
    public async startLogin(request: Request, response: Response): Promise<void> {

        // Check incoming details
        this._getLogEntry(response).setOperationName('startLogin');
        this._validateOrigin(request);

        // First create a random login state
        const loginState = this._authorizationServerClient.generateLoginState();

        // Write a temporary state cookie
        const cookieData = {
            state: loginState.state,
            codeVerifier: loginState.codeVerifier,
        };
        this._cookieProcessor.writeStateCookie(cookieData, response);

        // Write the response body
        const body = {
            authorizationRequestUri: this._authorizationServerClient.getAuthorizationRequestUri(loginState),
        };
        ResponseWriter.write(response, 200, body);
    }

    /*
     * The SPA sends us the full URL when the page loads, and it may contain an authorization result
     * Complete login if required, by swapping the authorization code for tokens and storing tokens in secure cookies
     */
    public async endLogin(request: Request, response: Response): Promise<void> {
        console.log('endLogin 1');
        // First do basic validation
        this._getLogEntry(response).setOperationName('endLogin');
        this._validateOrigin(request);

        console.log('endLogin 2');
        // Get the URL posted by the SPA
        const url = request.body['url'];
        if (!url) {
            throw ErrorUtils.fromFormFieldNotFoundError('url');
        }

        console.log('endLogin 3');
        // Get data from the SPA
        const query = UrlHelper.getQueryParameters(url);
        const code = query['code'];
        const state = query['state'];
        const error = query['error'];
        const errorDescription = query['error_description'];

        console.log('endLogin 4');
        console.log(error);
        console.log(code);
        console.log(errorDescription);
        console.log(url);
        // Handle normal page loads, which can occur frequently during a user session
        if (!(state && code) && !(state && error)) {
            const body = this._handlePageLoad(request, response);
            ResponseWriter.write(response, 200, body);
            return;
        }

        console.log('endLogin 5');
        // Report Authorization Server errors back to the SPA, such as those sending an invalid scope
        if (state && error) {
            const statusCode = OAuthErrorStatus.processAuthorizationResponseError(error);
            throw ErrorUtils.fromLoginResponseError(statusCode, error, errorDescription);
        }

        // Read the state cookie and then clear it
        const stateCookie = this._cookieProcessor.readStateCookie(request);
        if (!stateCookie) {
            throw ErrorUtils.fromMissingCookieError('state');
        }
        this._cookieProcessor.clearStateCookie(response);

        console.log('endLogin 6');
        // Check that the value posted matches that in the cookie
        if (state !== stateCookie.state) {
            throw ErrorUtils.fromInvalidStateError();
        }
        // Send the Authorization Code Grant message to the Authorization Server
        const authCodeGrantData = await this._authorizationServerClient.sendAuthorizationCodeGrant(
            code,
            stateCookie.codeVerifier);
        console.log('endLogin 7');
        const refreshToken = authCodeGrantData.refresh_token;
        console.log('RefreshToken: ' + refreshToken);
        // Refresh token might not be always returned. TODO
        if (!refreshToken) {
            throw ErrorUtils.createGenericError(
                'No refresh token was received in an authorization code grant response');
        }

        const accessToken = authCodeGrantData.access_token;
        console.log('AccessToken: ' + accessToken);
        if (!accessToken) {
            throw ErrorUtils.createGenericError(
                'No access token was received in an authorization code grant response');
        }

        // We do not validate the id token since it is received in a direct HTTPS request
        const idToken = authCodeGrantData.id_token;
        console.log('idToken: ' + idToken);
        if (!idToken) {
            throw ErrorUtils.createGenericError(
                'No id token was received in an authorization code grant response');
        }

        // Include the OAuth User ID in API logs
        this._logUserId(response, idToken);

        // Write tokens to separate HTTP only encrypted same site cookies
        if(refreshToken){
            this._cookieProcessor.writeRefreshCookie(refreshToken, response);
        }
        this._cookieProcessor.writeAccessCookie(accessToken, response);
        this._cookieProcessor.writeIdCookie(idToken, response);

        // Inform the SPA that that a login response was handled
        const endLoginData = {
            isLoggedIn: true,
            handled: true,
        } as EndLoginResponse;

        // Create an anti forgery cookie which will last for the duration of the multi tab browsing session
        this._createAntiForgeryResponseData(request, response, endLoginData);
        ResponseWriter.write(response, 200, endLoginData);
    }

    /*
     * Call the target API with an access token
     */
    public async _callApi(request: Request, accessToken: string): Promise<AxiosResponse> {

        // Get the route, which has been verified by the authorizer middleware
        // TODO
        console.log('_callApi1 ' + request.baseUrl);
        const url = 'https://api.officeapp-dev.com:446' + request.baseUrl;
        // Set request options
        console.log('_callApi2 ' + url);
        const options: any = {

            url: url,
            method: request.method,
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
            agentOptions: new https.Agent({
                key: fs.readFileSync('../certs/officeapp-dev.ssl.key', 'utf8'),
                cert: fs.readFileSync('../certs/officeapp-dev.ssl.p12', 'utf8'),
                rejectUnauthorized: false,
                keepAlive: false,
            }),
        };

        // Add any custom headers we have received from the client
        if (request.headers) {

            Object.keys(request.headers).forEach((name) => {
                if (name.startsWith('x-mycompany')) {
                    options.headers![name] = request.headers[name] as string;
                }
            });
        }

        // Ensure that the correlation id from the log entry is forwarded
        // options.headers!['x-mycompany-correlation-id'] = this._container.getLogEntry().getCorrelationId();

        // Supply a body if required
        if (request.body) {
            options.data = request.body;
        }
        console.log(options);
        try {

            // Try the request, and return the response on success
            return await axios.request(options);

        } catch (e: any) {

            if (e.response && e.response.status && e.response.data) {
                return e.response;
            }

            // Otherwise rethrow the exception, eg for a connectivity error
            throw ErrorUtils.fromApiHttpRequestError(e, options.url!);
        }
    }

    public async callApi(request: Request, response: Response): Promise<void> {
        //TODO ID Token contains JWT
        const accessToken = this._cookieProcessor.readIdCookie(request);
        console.log('callApi 1:' + accessToken);
        if (!accessToken) {
            throw ErrorUtils.fromMissingCookieError('access token');
        }
        // Forward the access token to the target API
        const apiResponse = await this._callApi(request, accessToken);

        // Write the response to the container
        return ResponseWriter.write(response, apiResponse.status, apiResponse.data);
    }

    /*
     * Write a new access token into the access token cookie
     */
    public async refresh(request: Request, response: Response): Promise<void> {

        // Check incoming details
        this._getLogEntry(response).setOperationName('refresh');
        this._validateOrigin(request);
        this._validateAntiForgeryCookie(request);

        // Get the refresh token from the cookie
        const refreshToken = this._cookieProcessor.readRefreshCookie(request);
        if (!refreshToken) {
            throw ErrorUtils.fromMissingCookieError('rt');
        }

        // Get the id token from the id cookie
        const idToken = this._cookieProcessor.readIdCookie(request);
        if (!idToken) {
            throw ErrorUtils.fromMissingCookieError('id');
        }

        // Include the OAuth user id in API logs
        this._logUserId(response, idToken);

        // Send the request for a new access token, and clear all cookies when the refresh token expires
        const refreshTokenGrantData = await this._authorizationServerClient.sendRefreshTokenGrant(refreshToken);

        // Rewrite cookies
        const newRefreshToken = refreshTokenGrantData.refresh_token;
        const newIdToken = refreshTokenGrantData.id_token;
        this._cookieProcessor.writeAccessCookie(refreshTokenGrantData.access_token, response);
        this._cookieProcessor.writeRefreshCookie(newRefreshToken ?? refreshToken, response);
        this._cookieProcessor.writeIdCookie(newIdToken ?? idToken, response);

        // Return an empty response to the browser
        ResponseWriter.write(response, 204, null);
    }

    /*
     * Return the logout URL and clear cookies
     */
    public async logout(request: Request, response: Response): Promise<void> {

        // Check incoming details
        this._getLogEntry(response).setOperationName('logout');
        this._validateOrigin(request);
        this._validateAntiForgeryCookie(request);

        // Get the id token from the id cookie
        const idToken = this._cookieProcessor.readIdCookie(request);
        if (!idToken) {
            throw ErrorUtils.fromMissingCookieError('id');
        }

        // Include the OAuth user id in API logs
        this._logUserId(response, idToken);

        // Clear all cookies for the caller
        this._cookieProcessor.clearAll(response);

        // Return the full end session URL
        const data = {
            endSessionRequestUri: this._authorizationServerClient.getEndSessionRequestUri(idToken),
        };
        ResponseWriter.write(response, 200, data);
    }

    /*
     * Make the refresh and / or the access token inside secure cookies act expired, for testing purposes
     */
    public async expire(request: Request, response: Response): Promise<void> {

        // Get whether to expire the access or refresh token
        const type = request.body['type'];
        const operation = type === 'access' ? 'expireAccessToken' : 'expireRefreshToken';

        // Check incoming details
        this._getLogEntry(response).setOperationName(operation);
        this._validateOrigin(request);
        this._validateAntiForgeryCookie(request);

        // Get the current refresh token
        const accessToken = this._cookieProcessor.readAccessCookie(request);
        if (!accessToken) {
            throw ErrorUtils.fromMissingCookieError('at');
        }

        // Get the current refresh token
        const refreshToken = this._cookieProcessor.readRefreshCookie(request);
        if (!refreshToken) {
            throw ErrorUtils.fromMissingCookieError('rt');
        }

        // Get the id token from the id cookie
        const idToken = this._cookieProcessor.readIdCookie(request);
        if (!idToken) {
            throw ErrorUtils.fromMissingCookieError('id');
        }

        // Include the OAuth user id in API logs
        this._logUserId(response, idToken);

        // Always make the access cookie act expired to cause an API 401
        const expiredAccessToken = `${accessToken}x`;
        this._cookieProcessor.writeAccessCookie(expiredAccessToken, response);

        // If requested, make the refresh cookie act expired, to cause a permanent API 401
        if (type === 'refresh') {
            const expiredRefreshToken = `${refreshToken}x`;
            this._cookieProcessor.writeRefreshCookie(expiredRefreshToken, response);
        }

        // Return an empty response to the browser
        ResponseWriter.write(response, 204, null);
    }

    /*
     * Make sure there is a web origin, as supported by the 4 main browsers, and make sure it matches the expected value
     */
    private _validateOrigin(request: Request): void {

        const origin = HeaderProcessor.getHeader(request, 'origin');
        if (!origin) {
            throw ErrorUtils.fromMissingOriginError();
        }

        const found = this._apiConfiguration.trustedWebOrigins.find(o => o.toLowerCase() === origin.toLowerCase());
        if (!found) {
            throw ErrorUtils.fromUntrustedOriginError();
        }
    }

    /*
     * Extra cookies checks for data changing requests in line with OWASP
     */
    private _validateAntiForgeryCookie(request: Request): void {

        // Get the cookie value
        const cookieValue = this._cookieProcessor.readAntiForgeryCookie(request);
        if (!cookieValue) {
            throw ErrorUtils.fromMissingCookieError('csrf');
        }

        // Check the client has sent a matching anti forgery request header
        const headerName = this._cookieProcessor.getAntiForgeryRequestHeaderName();
        const headerValue = HeaderProcessor.getHeader(request, headerName);
        if (!headerValue) {
            throw ErrorUtils.fromMissingAntiForgeryTokenError();
        }

        // Check that the values match
        if (cookieValue !== headerValue) {
            throw ErrorUtils.fromMismatchedAntiForgeryTokenError();
        }
    }

    /*
     * Give the SPA the data it needs when it loads or the page is refreshed or a new browser tab is opened
     */
    private _handlePageLoad(request: Request, response: Response): EndLoginResponse {

        // Inform the SPA that this is a normal page load and not a login response
        const pageLoadData = {
            handled: false,
        } as any;

        const existingIdToken = this._cookieProcessor.readIdCookie(request);
        const antiForgeryToken = this._cookieProcessor.readAntiForgeryCookie(request);
        if (existingIdToken && antiForgeryToken) {

            // Return data for the case where the user is already logged in
            pageLoadData.isLoggedIn = true;
            pageLoadData.antiForgeryToken = antiForgeryToken;
            this._logUserId(response, existingIdToken);

        } else {

            // Return data for the case where the user is not logged in
            pageLoadData.isLoggedIn = false;
        }

        return pageLoadData;
    }

    /*
     * Add anti forgery details to the response after signing in
     */
    private _createAntiForgeryResponseData(request: Request, response: Response, data: any): void {

        // Get a random value
        const newCookieValue = this._cookieProcessor.generateAntiForgeryValue();

        // Set an anti forgery HTTP Only encrypted cookie
        this._cookieProcessor.writeAntiForgeryCookie(response, newCookieValue);

        // Also give the UI the anti forgery token in the response body
        data.antiForgeryToken = newCookieValue;
    }

    /*
     * Parse the id token then include the user id in logs
     */
    private _logUserId(response: Response, idToken: string): void {

        const parts = idToken.split('.');
        if (parts.length === 3) {

            const payload = base64url.decode(parts[1]);
            if (payload) {
                const claims = JSON.parse(payload);
                if (claims.sub) {
                    this._getLogEntry(response).setUserId(claims.sub);
                }
            }
        }
    }

    /*
     * Get the current log entry
     */
    private _getLogEntry(response: Response) {
        return response.locals.logEntry as LogEntry;
    }

    /*
     * Make the this parameter available for when the API is called
     */
    private _setupCallbacks(): void {
        this.startLogin = this.startLogin.bind(this);
        this.endLogin = this.endLogin.bind(this);
        this.refresh = this.refresh.bind(this);
        this.expire = this.expire.bind(this);
        this.logout = this.logout.bind(this);
        this.callApi = this.callApi.bind(this);
    }
}
