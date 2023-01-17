import urlparse from 'url-parse';

/*
 * URL utilities
 */
export class UrlHelper {

    /*
     * Return a URL encoded query parameter
     */
    public static createQueryParameter(key: string, value: string): string {
        return `${key}=${encodeURIComponent(value)}`;
    }

    /*
     * Get all query parameters as an object
     */
    public static getQueryParameters(url: string): any {

        const urlData = urlparse(url, true);
        return urlData.query || {};
    }

    public static getUrl(url: string, urlReplaceString: string, urlToReplace: string): any {
        return url.replace(urlToReplace, urlReplaceString);
    }
}
