export interface webhooktrigger {
  /**
   * This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using flags.
   */
  '--help'?: ''

  /**
   * The requested webhook topic.
   */
  '--topic <value>'?: string

  /**
   * The API Version of the webhook topic.
   */
  '--api-version <value>'?: string

  /**
   * Method chosen to deliver the topic payload. If not passed, it's inferred from the address.
   */
  '--delivery-method <value>'?: string

  /**
   * Deprecated. Please use client-secret.
   */
  '--shared-secret <value>'?: string

  /**
   * Your app's client secret. This secret allows us to return the X-Shopify-Hmac-SHA256 header that lets you validate the origin of the response that you receive.
   */
  '--client-secret <value>'?: string

  /**
   * The URL where the webhook payload should be sent.
                    You will need a different address type for each delivery-method:
                          · For remote HTTP testing, use a URL that starts with https://
      · For local HTTP testing, use http://localhost:{port}/{url-path}
                          · For Google Pub/Sub, use pubsub://{project-id}:{topic-id}
                          · For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events:
   */
  '--address <value>'?: string
}
