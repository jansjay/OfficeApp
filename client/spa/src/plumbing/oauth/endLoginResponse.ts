/*
 * Data returned from the Token Handler API to the Office App SPA, to inform it of the logged in state
 */
export interface EndLoginResponse {

    // True if there are valid cookies
    isLoggedIn: boolean;

    // True if an Authorization response has just been handled
    handled: boolean;

    // A new value is generated for each authenticated user session, then returned to all browser tabs
    antiForgeryToken: string | null;
}
