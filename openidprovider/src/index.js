import express from 'express';
import fs from 'fs-extra';
import Provider from 'oidc-provider';
import https from 'https';
/*
 * The web host entry point
 */
(async () => {

    // First load configuration
    const configurationBuffer = await fs.readFile('webhost.config.json');
    const configuration =  JSON.parse(configurationBuffer.toString());

    // Create the web host
    const expressApp = express();
    const openidConfiguration = {
      // ... see the available options in Configuration options section
      clients: [{
        client_id: 'foo',
        client_secret: 'bar',
        redirect_uris: ['http://lvh.me:8080/cb'],
        // + other client properties
      }],
      // ...
    };

    expressApp.use('/', new Provider(configuration.host + ":" + configuration.port,  openidConfiguration).callback);
    const pfxFile = await fs.readFile(configuration.sslCertificateFileName);
    const serverOptions = {
      pfx: pfxFile,
      passphrase: configuration.sslCertificatePassword,
    };

    // Start listening
    const httpsServer = https.createServer(serverOptions, expressApp);
    httpsServer.listen(configuration.port, () => {
      console.log(`Web Host is listening on HTTPS port ${configuration.port}`);
    });    
})();