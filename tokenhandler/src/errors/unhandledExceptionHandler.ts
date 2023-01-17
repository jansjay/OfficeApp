import {Response} from 'express';
import {CookieProcessor} from '../agent/cookieProcessor';
import {ApiConfiguration} from '../configuration/apiConfiguration';
import {LogEntry} from '../logging/logEntry';
import {ResponseWriter} from '../utilities/responseWriter';
import {ClientError} from './clientError';
import {ErrorCodes} from './errorCodes';
import {ErrorUtils} from './errorUtils';
import {ServerError} from './serverError';

/*
 * The entry point for unhandled exceptions
 */
export class UnhandledExceptionHandler {

    private readonly _configuration: ApiConfiguration;

    public constructor(configuration: ApiConfiguration) {
        this._configuration = configuration;
    }

    /*
     * Handle the server error and write client details to the response
     */
    public handleError(exception: any, response: Response): void {

        // Get the error to return
        const clientError = this._logError(exception, response);

        // Handle the special case where the OAuth Agent has failed to get a new access token with the refresh token
        // In this case we clear all cookies, to inform the SPA that the user must re-authenticate
        if (clientError.statusCode === 401 && clientError.errorCode === ErrorCodes.sessionExpiredError) {

            const cookieProcessor = new CookieProcessor(this._configuration);
            cookieProcessor.clearAll(response);
        }

        // Return the error response to the client as a JSON object
        ResponseWriter.write(response, clientError.statusCode, clientError.toResponseFormat());
    }

    /*
     * Process the error and include it in the log entry
     */
    private _logError(exception: any, response: Response): ClientError {

        const handledError = ErrorUtils.fromException(exception);
        if (exception instanceof ClientError) {

            const clientError = handledError as ClientError;
            const logEntry = response.locals.logEntry as LogEntry;
            if (clientError.logContext && clientError.logContext.code) {
                logEntry.setErrorCodeOverride(clientError.logContext.code);
            }

            logEntry.setClientError(clientError);
            return clientError;

        } else {

            const serverError = handledError as ServerError;
            const logEntry = response.locals.logEntry as LogEntry;
            logEntry.setServerError(serverError);
            console.log(serverError);
            return serverError.toClientError();
        }
    }
}
