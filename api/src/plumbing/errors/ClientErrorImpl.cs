namespace SampleApi.Plumbing.Errors
{
    using System.Net;
    using Newtonsoft.Json.Linq;

    /*
     * The error type for an incorrect client request
     */
    internal sealed class ClientErrorImpl : ClientError
    {
        // Mandatory fields for both 4xx and 500 errors
        private readonly HttpStatusCode statusCode;
        private readonly string errorCode;
        private JToken logContext;

        // Extra fields returned to the client for UI displays of 500 errors
        private string area;
        private int id;
        private string utcTime;

        /*
         * All client errors use an error code
         */
        public ClientErrorImpl(HttpStatusCode statusCode, string errorCode, string message)
            : base(message)
        {
            // Set mandatory fields
            this.statusCode = statusCode;
            this.errorCode = errorCode;
            this.logContext = null;

            // Initialise 5xx fields
            this.area = string.Empty;
            this.id = 0;
            this.utcTime = string.Empty;
        }

        public override HttpStatusCode StatusCode
        {
            get
            {
                return this.statusCode;
            }
        }

        public override string ErrorCode
        {
            get
            {
                return this.errorCode;
            }
        }

        public void SetLogContext(JToken value)
        {
            this.logContext = value;
        }

        /*
         * Set extra fields to return to the caller for 500 errors
         */
        public override void SetExceptionDetails(string area, int id, string utcTime)
        {
            this.area = area;
            this.id = id;
            this.utcTime = utcTime;
        }

        /*
         * Return a dynamic object that can be serialized by calling toString
         */
        public override JObject ToResponseFormat()
        {
            dynamic data = new JObject();
            data.code = this.errorCode;
            data.message = this.Message;

            if (this.id > 0 && this.area.Length > 0 && this.utcTime.Length > 0)
            {
                data.id = this.id;
                data.area = this.area;
                data.utcTime = this.utcTime;
            }

            return data;
        }

        /*
         * Contribute the error data to logs
         */
        public override JObject ToLogFormat()
        {
            dynamic data = new JObject();
            data.statusCode = this.StatusCode;
            data.body = this.ToResponseFormat();

            if (this.logContext != null)
            {
                data.context = this.logContext;
            }

            return data;
        }
    }
}
