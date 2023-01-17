namespace SampleApi.IntegrationTests
{
    using System;
    using System.Net;
    using System.Threading.Tasks;
    using Newtonsoft.Json.Linq;
    using SampleApi.Test.Utils;
    using Xunit;

    /*
     * Test the API in isolation, without any dependencies on the Authorization Server
     */
    public class IntegrationTests : IClassFixture<IntegrationTestState>, IDisposable
    {
        // State shared across the suite of tests
        private readonly IntegrationTestState state;

        // The real subject claim values for my two online test users
        private readonly string guestUserId = "a6b404b1-98af-41a2-8e7f-e4061dc0bf86";
        private readonly string guestAdminId = "77a97e5b-b748-45e5-bb6f-658e85b2df91";

        /*
         * Initialize mock token issuing and wiremock before a test runs
         */
        public IntegrationTests(IntegrationTestState state)
        {
            this.state = state;
        }

        /*
         * Dispose per test state
         */
        public void Dispose()
        {
            this.state.WiremockAdmin.UnregisterUserInfo().Wait();
        }

        /*
         * Test getting claims
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetUserClaims_ReturnsSingleRegion_ForStandardUser()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestUserId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Guest";
            data.family_name = "User";
            data.email = "guestuser@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetUserInfoClaims(options);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.OK, "Unexpected HTTP status code");
            var claims = JObject.Parse(response.Body);
            var regions = claims.Value<JArray>("regions");
            Assert.True(regions.Count == 1, "Unexpected regions claim");
        }

        /*
         * Test getting claims for the admin user
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetUserClaims_ReturnsAllRegions_ForAdminUser()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestAdminId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Admin";
            data.family_name = "User";
            data.email = "guestadmin@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetUserInfoClaims(options);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.OK, "Unexpected HTTP status code");
            var claims = JObject.Parse(response.Body);
            var regions = claims.Value<JArray>("regions");
            Assert.True(regions.Count == 3, "Unexpected regions claim");
        }

        /*
         * Test getting companies
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetCompanies_ReturnsTwoItems_ForStandardUser()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestUserId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Guest";
            data.family_name = "User";
            data.email = "guestuser@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetCompanies(options);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.OK, "Unexpected HTTP status code");
            var companies = JArray.Parse(response.Body);
            Assert.True(companies.Count == 2, "Unexpected companies list");
        }

        /*
         * Test getting companies for the admin user
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetCompanies_ReturnsAllItems_ForAdminUser()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestAdminId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Admin";
            data.family_name = "User";
            data.email = "guestadmin@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetCompanies(options);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.OK, "Unexpected HTTP status code");
            var companies = JArray.Parse(response.Body);
            Assert.True(companies.Count == 4, "Unexpected companies list");
        }

        /*
         * Test getting companies with a malicious JWT access token
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetCompanies_Returns401_ForMaliciousJwt()
        {
            // Get a malicious access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueMaliciousAccessToken(this.guestUserId);

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetCompanies(options);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, "Unexpected HTTP status code");
            var error = JObject.Parse(response.Body);
            var code = error.Value<string>("code");
            Assert.True(code == "unauthorized", "Unexpected error code");
        }

        /*
         * Test getting allowed transactions
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetTransactions_ReturnsAllowedItems_ForCompaniesMatchingTheRegionClaim()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestUserId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Guest";
            data.family_name = "User";
            data.email = "guestuser@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetCompanyTransactions(options, 2);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.OK, "Unexpected HTTP status code");
            var payload = JObject.Parse(response.Body);
            var transactions = payload.Value<JArray>("transactions");
            Assert.True(transactions.Count == 8, "Unexpected transactions list");
        }

        /*
         * Test getting unauthorized transactions
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task GetTransactions_ReturnsNotFoundForUser_ForCompaniesNotMatchingTheRegionClaim()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestUserId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Guest";
            data.family_name = "User";
            data.email = "guestuser@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            var response = await this.state.ApiClient.GetCompanyTransactions(options, 3);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.NotFound, "Unexpected HTTP status code");
            var error = JObject.Parse(response.Body);
            var code = error.Value<string>("code");
            Assert.True(code == "company_not_found", "Unexpected error code");
        }

        /*
         * Test rehearsing a 500 error when there is an exception in the API
         */
        [Fact]
        [Trait("Category", "Integration")]
        public async Task FailedApiCall_ReturnsSupportable500Error_ForErrorRehearsalRequest()
        {
            // Get an access token for the end user of this test
            var accessToken = this.state.TokenIssuer.IssueAccessToken(this.guestUserId);

            // The API will call the Authorization Server to get user info for the token, so register a mock response
            dynamic data = new JObject();
            data.given_name = "Guest";
            data.family_name = "User";
            data.email = "guestuser@mycompany.com";
            await this.state.WiremockAdmin.RegisterUserInfo(data.ToString());

            // Call the API
            var options = new ApiRequestOptions(accessToken);
            options.RehearseException = true;
            var response = await this.state.ApiClient.GetCompanyTransactions(options, 3);

            // Assert expected results
            Assert.True(response.StatusCode == HttpStatusCode.InternalServerError, "Unexpected HTTP status code");
            var error = JObject.Parse(response.Body);
            var code = error.Value<string>("code");
            Assert.True(code == "exception_simulation", "Unexpected error code");
        }
    }
}
