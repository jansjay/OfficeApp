import {Configuration} from './configuration';

/*
 * This deployment points to Serverless APIs
 */
export const productionServerlessConfiguration = {

    app: {
        webOrigin: 'https://web.officeapp-dev.com',
        apiBaseUrl: 'https://tokenhandler.officeapp-dev.com/api'
    },
    oauth: {
        oauthAgentBaseUrl: 'https://tokenhandler.officeapp-dev.com/oauth-agent',
    }
} as Configuration;

/*
 * This deployment points to APIs running a Kubernetes cluster
 */
export const productionCloudNativeConfiguration = {

    app: {
        webOrigin: 'https://web.officeapp-de-k8s.com',
        apiBaseUrl: 'https://tokenhandler.officeapp-de-k8s.com/api'
    },
    oauth: {
        oauthAgentBaseUrl: 'https://tokenhandler.officeapp-de-k8s.com/oauth-agent',
    }
} as Configuration;
