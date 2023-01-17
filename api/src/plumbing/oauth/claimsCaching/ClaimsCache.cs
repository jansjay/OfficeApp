namespace SampleApi.Plumbing.OAuth.ClaimsCaching
{
    using System;
    using System.Collections.Generic;
    using System.Security.Claims;
    using System.Text;
    using System.Threading.Tasks;
    using Microsoft.Extensions.Caching.Distributed;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Logging;

    /*
     * A wrapper for a thread safe memory cache
     */
    public sealed class ClaimsCache
    {
        private readonly IDistributedCache cache;
        private readonly int timeToLiveMinutes;
        private readonly ILogger traceLogger;

        public ClaimsCache(
            IDistributedCache cache,
            int timeToLiveMinutes,
            ServiceProvider container)
        {
            this.cache = cache;
            this.timeToLiveMinutes = timeToLiveMinutes;

            // Get a development trace logger for this class
            this.traceLogger = container.GetService<ILoggerFactory>().CreateLogger<ClaimsCache>();
        }

        /*
         * Add our custom claims to the cache
         */
        public async Task SetExtraUserClaimsAsync(string accessTokenHash, IEnumerable<Claim> extraClaims, int expiry)
        {
            // Check for a race condition where the token passes validation but it expired when it gets here
            var now = DateTimeOffset.UtcNow;
            var epochSeconds = now.ToUnixTimeSeconds();
            var secondsToCache = expiry - epochSeconds;
            if (secondsToCache > 0)
            {
                // Get the hash and output debug info
                this.traceLogger.LogDebug($"Token to be cached will expire in {secondsToCache} seconds (hash: {accessTokenHash})");

                // Do not exceed the maximum time we configured
                if (secondsToCache > this.timeToLiveMinutes * 60)
                {
                    secondsToCache = this.timeToLiveMinutes * 60;
                }

                // Serialize claims to bytes
                var json = ClaimsSerializer.Serialize(extraClaims);
                var bytes = Encoding.UTF8.GetBytes(json);

                // Cache the token until the above time
                var options = new DistributedCacheEntryOptions
                {
                    AbsoluteExpiration = now.AddSeconds(secondsToCache),
                };

                this.traceLogger.LogDebug($"Adding token to claims cache for {secondsToCache} seconds (hash: {accessTokenHash})");
                await this.cache.SetAsync(accessTokenHash, bytes, options);
            }
        }

        /*
         * Read our custom claims from the cache or return null if not found
         */
        public async Task<IEnumerable<Claim>> GetExtraUserClaimsAsync(string accessTokenHash)
        {
            // Get the hash as a cache key and see if it exists in the cache
            var bytes = await this.cache.GetAsync(accessTokenHash);
            if (bytes == null)
            {
                this.traceLogger.LogDebug($"New token will be added to claims cache (hash: {accessTokenHash})");
                return new List<Claim>();
            }

            // Deserialize bytes to claims
            this.traceLogger.LogDebug($"Found existing token in claims cache (hash: {accessTokenHash})");
            var json = Encoding.UTF8.GetString(bytes);
            return ClaimsSerializer.Deserialize(json);
        }
    }
}
