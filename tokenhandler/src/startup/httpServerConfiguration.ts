import cookieParser from 'cookie-parser';
import cors, {CorsOptions} from 'cors';
import express, {Application, NextFunction, Request, Response} from 'express';
import fs from 'fs-extra';
import https from 'https';
import {AuthorizationServerClient} from '../agent/authorizationServerClient';
import {CookieProcessor} from '../agent/cookieProcessor';
import {OAuthAgent} from '../agent/oauthAgent';
import {Configuration} from '../configuration/configuration';
import {ErrorUtils} from '../errors/errorUtils';
import {UnhandledExceptionHandler } from '../errors/unhandledExceptionHandler';
import {LoggerMiddleware } from '../logging/loggerMiddleware';
import {HttpProxy} from '../utilities/httpProxy';
//use httpproxy here as well TODO
import * as proxy from 'http-proxy-middleware';
/*
 * Configure Express API behaviour
 */
export class HttpServerConfiguration {

    private readonly _expressApp: Application;
    private readonly _configuration: Configuration;
    private readonly _oauthAgent: OAuthAgent;
    private readonly _cookieProcessor: CookieProcessor;
    /*
     * Auto wire the main authorizer class, which is the entry point for processing
     */
    public constructor(
        expressApp: Application,
        configuration: Configuration,
        httpProxy: HttpProxy) {

        this._expressApp = expressApp;
        this._configuration = configuration;
        this._cookieProcessor = new CookieProcessor(configuration.api);
        console.log(this._cookieProcessor);
        this._oauthAgent = new OAuthAgent(
            this._configuration.api,
            this._cookieProcessor,
            new AuthorizationServerClient(configuration.api, configuration.client, httpProxy));

        this._setupCallbacks();
    }

    /*
     * Set up routes for the API's OAuth operations
     */
    public async initialiseRoutes(): Promise<void> {

        // Configure CORS
        this._expressApp.use('/oauth-agent/*', cors(this._getCorsOptions()) as any);
        this._expressApp.use('/api/*', cors(this._getCorsOptions()) as any);

        // Parse cookies and the request body
        this._expressApp.use('/oauth-agent/*', cookieParser());
        this._expressApp.use('/oauth-agent/*', express.json());
        this._expressApp.use('/api/*', cookieParser());
        this._expressApp.use('/api/*', express.json());

        // Add logging middleware
        const loggingMiddleware = new LoggerMiddleware(this._configuration.logging);
        this._expressApp.use('/oauth-agent/*', loggingMiddleware.logRequest);
        this._expressApp.use('/api/*', loggingMiddleware.logRequest);

        // Do not cache API requests
        this._expressApp.set('etag', false);

        // Route requests through to the authorizer
        this._expressApp.post('/oauth-agent/login/start', this._catch(this._oauthAgent.startLogin));
        this._expressApp.post('/oauth-agent/login/end',   this._catch(this._oauthAgent.endLogin));
        this._expressApp.post('/oauth-agent/refresh',     this._catch(this._oauthAgent.refresh));
        this._expressApp.post('/oauth-agent/expire',      this._catch(this._oauthAgent.expire));
        this._expressApp.post('/oauth-agent/logout',      this._catch(this._oauthAgent.logout));

        this._expressApp.use('/api/*', this._catch(this._oauthAgent.callApi));

        // Handle failures
        this._expressApp.use('/oauth-agent/*', this._onRequestNotFound);
        this._expressApp.use('/oauth-agent/*', this._onException);

        //TODO self sign certificate in use
        //const apiProxy = proxy.createProxyMiddleware('/api', {target: 'https://api.officeapp-dev.com:446/api',
        //    'secure': false,
        //    changeOrigin: true,
        //    onProxyReq: this.relayRequestHeaders,
        //    //onProxyRes: this.relayResponseHeaders
        //});
        //this._expressApp.use(apiProxy);
    }

    public relayRequestHeaders(proxyReq: any, req: any): void {
        console.log(this._cookieProcessor);
        console.log(this._oauthAgent._cookieProcessor.readAccessCookie(req));
        //console.log(this._oauthAgent._cookieProcessor.readAccessCookie(proxyReq));
        if(this._cookieProcessor != undefined) {
            const accessToken = this._cookieProcessor.readAccessCookie(req);
            if (!accessToken) {
                throw ErrorUtils.fromMissingCookieError('access token');
            }
            proxyReq.setHeader('authorization', `Bearer ${accessToken}`);
        }
    }

    /*
     * Start listening for requests
     */
    public async startListening(): Promise<void> {

        if (this._configuration.host.sslCertificateFileName && this._configuration.host.sslCertificatePassword) {

            // Load certificate details
            const pfxFile = await fs.readFile(this._configuration.host.sslCertificateFileName);
            const serverOptions = {
                pfx: pfxFile,
                passphrase: this._configuration.host.sslCertificatePassword,
            };

            // Start listening over HTTPS
            const httpsServer = https.createServer(serverOptions, this._expressApp);
            httpsServer.listen(this._configuration.host.port, () => {
                console.log(`OAuth Agent is listening on HTTPS port ${this._configuration.host.port}`);
            });

        } else {

            // Otherwise listen over HTTP
            this._expressApp.listen(this._configuration.host.port, () => {
                console.log(`OAuth Agent is listening on HTTP port ${this._configuration.host.port}`);
            });
        }
    }

    /*
     * The Express API handles CORS headers for OPTIONS, GET and POST requests
     * Allowed headers are not configured so any requested headers are returned in OPTIONS responses
     */
    private _getCorsOptions(): CorsOptions {

        return {
            origin: this._configuration.api.trustedWebOrigins,
            credentials: true,
            maxAge: 86400,
        } as CorsOptions;
    }

    /*
     * Deal with Express unhandled promise exceptions during async API requests
     * https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016
     */
    private _catch(fn: any): any {

        return (request: Request, response: Response, next: NextFunction) => {

            Promise
                .resolve(fn(request, response, next))
                .catch((e) => {
                    this._onException(e, request, response);
                });
        };
    }

    /*
     * Handle requests to routes that do not exist, by logging the error and returning a client response
     */
    /* eslint-disable @typescript-eslint/no-unused-vars */
    private _onException(unhandledException: any, request: Request, response: Response): void {

        const handler = new UnhandledExceptionHandler(this._configuration.api);
        handler.handleError(unhandledException, response);
    }

    /*
     * Handle requests to routes that do not exist, by logging the error and returning a client response
     */
    /* eslint-disable @typescript-eslint/no-unused-vars */
    private _onRequestNotFound(
        request: Request,
        response: Response,
        next: NextFunction): void {

        const handler = new UnhandledExceptionHandler(this._configuration.api);
        handler.handleError(ErrorUtils.fromRequestNotFound(), response);
    }

    /*
     * Make the this parameter available in callbacks
     */
    private _setupCallbacks(): void {
        this._onException = this._onException.bind(this);
        this._onRequestNotFound = this._onRequestNotFound.bind(this);
    }
}
