/*
 * Configuration for the API logic
 */
export interface ApiConfiguration {

    authorizeEndpoint: string;

    tokenEndpoint: string;

    endSessionEndpoint: string;

    cookieDomain: string,

    cookiePrefix: string,

    cookieEncryptionKey: string;

    trustedWebOrigins: string[];

    provider: string;
}
