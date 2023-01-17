using System;
using WireMock.Net.StandAlone;
using WireMock.Settings;
/*using WireMock.Logging;*/

class Program
{
    static void Main(string[] args)
    {
        var settings = new WireMockServerSettings
        {
            Urls = new [] { "https://login.officeapp-dev.com:447" },
            CertificateSettings = new WireMockCertificateSettings
            {
                X509CertificateFilePath = "../../certs/officeapp-dev.ssl.p12",
                X509CertificatePassword = "Password1"
            },
            StartAdminInterface = true,
            AllowPartialMapping = true
            /*Logger = new WireMockConsoleLogger()*/
        };

        StandAloneApp.Start(settings);
        Console.WriteLine("Wiremock is listening on port 447 ...");
        if(!Console.IsInputRedirected) {
            Console.ReadKey();
        }
    }
}
