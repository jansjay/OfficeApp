namespace SampleApi.Plumbing.OAuth.ClaimsCaching
{
    using System.Collections.Generic;
    using System.Security.Claims;
    using Newtonsoft.Json.Linq;

    /*
     * A simple utility class to read and write claims
     */
    public static class ClaimsSerializer
    {
        /*
         * Serialize a collection of claims to JSON containing an array of objects
         */
        public static string Serialize(IEnumerable<Claim> claims)
        {
            var data = new JArray();

            foreach (var claim in claims)
            {
                dynamic child = new JObject();
                child.name = claim.Type;
                child.value = claim.Value;
                data.Add(child);
            }

            return data.ToString();
        }

        /*
         * Deserialize a collection of claimns from a JSON array of objects
         */
        public static IEnumerable<Claim> Deserialize(string json)
        {
            var nodes = JArray.Parse(json);
            var claims = new List<Claim>();

            foreach (var node in nodes)
            {
                var child = (JObject)node;
                var name = child.GetValue("name").Value<string>();
                var value = child.GetValue("value").Value<string>();
                claims.Add(new Claim(name, value));
            }

            return claims;
        }
    }
}
